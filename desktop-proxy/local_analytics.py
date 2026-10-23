"""Build a local, offline review page from primary Codex rollout sessions."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from itertools import chain
from pathlib import Path
from typing import Iterator, TextIO

from rollout_normalizer import normalize_lines


_ZSTD_JS = "require('node:fs').createReadStream(process.argv[1]).pipe(require('node:zlib').createZstdDecompress()).pipe(process.stdout)"
_HTML = r'''<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Analytics local | Governança de IA</title>
  <style>__STYLE__
    select { min-height: 44px; padding: 7px 10px; color: #23394e; background: white; border: 1px solid var(--control-border); border-radius: 7px; }
    .local-note { margin: 0 0 22px; padding: 12px 14px; color: #5b481c; background: #fff8e6; border: 1px solid #ead49d; border-radius: 8px; }
    .interaction header { align-items: flex-start; flex-direction: column; }
  </style>
</head>
<body>
  <main class="page">
    <header class="topbar">
      <div class="brand" aria-label="Governança de IA">
        <span class="brand-mark" aria-hidden="true">IA</span>
        <span class="brand-name">GOVERNANÇA <span>IA</span></span>
      </div>
      <div class="partner" aria-label="Castelo Branco Contabilidade Avançada">
        <span class="partner-mark" aria-hidden="true">✦</span>
        <span class="partner-name"><strong>CASTELO BRANCO</strong><small>CONTABILIDADE AVANÇADA</small></span>
      </div>
    </header>
    <section class="hero" aria-labelledby="page-title">
      <p class="eyebrow">Revisão local</p>
      <h1 id="page-title">Analytics de interações locais</h1>
      <p id="subtitle"></p>
    </section>
    <div id="status" class="status success" role="status" aria-live="polite"></div>
    <p class="local-note">Esta página contém textos de mensagens e funciona sem conexão com o backend. O código de colaborador foi associado localmente e está marcado como inferido.</p>
    <form id="filters" class="toolbar" aria-label="Busca por código do colaborador">
      <label class="field">Código do colaborador<input id="filter-code" type="search" maxlength="64" placeholder="COLAB-000"></label>
      <button class="button" type="submit">Buscar</button>
    </form>
    <section aria-labelledby="totals-title">
      <h2 id="totals-title" class="section-heading"><span class="section-number" aria-hidden="true">1</span><span>Resumo local</span></h2>
      <div class="cards" id="totals" aria-live="polite"></div>
    </section>
    <div class="tables">
      <section aria-labelledby="origins-title">
        <h2 id="origins-title" class="section-heading"><span class="section-number" aria-hidden="true">2</span><span>Por aplicativo</span></h2>
        <div class="table-wrap" tabindex="0" role="region" aria-labelledby="origins-title"><table><thead><tr><th scope="col">Aplicativo</th><th scope="col">Sessões</th><th scope="col">Prompts</th><th scope="col">Respostas</th></tr></thead><tbody id="origins"></tbody></table></div>
      </section>
      <section aria-labelledby="employees-title">
        <h2 id="employees-title" class="section-heading"><span class="section-number" aria-hidden="true">3</span><span>Por colaborador</span></h2>
        <div class="table-wrap" tabindex="0" role="region" aria-labelledby="employees-title"><table><thead><tr><th scope="col">Código</th><th scope="col">Vínculo</th><th scope="col">Sessões</th><th scope="col">Eventos</th></tr></thead><tbody id="employees"></tbody></table></div>
      </section>
    </div>
    <section class="search-section" aria-labelledby="search-title">
      <h2 id="search-title" class="section-heading"><span class="section-number" aria-hidden="true">4</span><span>Buscar interações</span></h2>
      <div id="interaction-results" class="interaction-list" aria-live="polite"></div>
      <nav id="interaction-pagination" class="pagination" aria-label="Paginação das interações" hidden>
        <button id="search-previous" class="button secondary" type="button">Anterior</button>
        <span id="search-page"></span>
        <button id="search-next" class="button secondary" type="button">Próxima</button>
      </nav>
    </section>
    <footer>Fonte: rollouts locais do Codex. A interface associa cada evento ao código local exibido, mantém prompts e respostas separados e não envia dados ao backend.</footer>
  </main>
  <script id="analytics-data" type="application/json">__DATA__</script>
  <script>
    const data = JSON.parse(document.querySelector("#analytics-data").textContent);
    const byId = (id) => document.getElementById(id);
    const numberFormat = new Intl.NumberFormat("pt-BR");
    const pageSize = 25;
    let page = 0;
    const sessions = data.sessions;
    const events = sessions.flatMap((session) => session.events.map((event) => ({
      ...event, source_app: session.source_app, session_started_at: session.started_at,
      source_label: session.source_label, thread_id: session.thread_id,
      collaborator_code: session.collaborator_code
    })));

    byId("subtitle").textContent = `${data.report.generated_at} · ${data.report.primary_rollouts} rollouts principais · ${data.report.collaborator_code} · ${numberFormat.format(events.length)} eventos`;
    byId("status").textContent = `${numberFormat.format(sessions.length)} sessões locais. Não há consulta ao serviço.`;

    function addCell(row, value, numeric = false) {
      const cell = document.createElement("td");
      cell.textContent = value == null || value === "" ? "Não disponível" : String(value);
      if (numeric) {
        cell.className = "numeric";
        cell.textContent = numberFormat.format(Number(value || 0));
      }
      row.append(cell);
    }

    function renderRows(target, rows, columns, emptyMessage) {
      target.replaceChildren();
      if (!rows.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columns.length;
        cell.className = "empty";
        cell.textContent = emptyMessage;
        row.append(cell);
        target.append(row);
        return;
      }
      for (const item of rows) {
        const row = document.createElement("tr");
        for (const [key, numeric] of columns) addCell(row, item[key], numeric);
        target.append(row);
      }
    }

    const cards = [
      ["Sessões locais", data.summary.sessions],
      ["Prompts", data.summary.prompts],
      ["Respostas", data.summary.responses],
      ["Chamadas MCP", data.summary.mcp_calls]
    ];
    for (const [label, value] of cards) {
      const card = document.createElement("article");
      card.className = "card";
      const name = document.createElement("div");
      name.className = "card-label";
      name.textContent = label;
      const total = document.createElement("div");
      total.className = "card-value";
      total.textContent = numberFormat.format(value);
      card.append(name, total);
      byId("totals").append(card);
    }

    const sourceRows = [...new Set(sessions.map((session) => session.source_app))].map((source) => {
      const group = sessions.filter((session) => session.source_app === source);
      return {
        source,
        sessions: group.length,
        prompts: group.reduce((sum, item) => sum + item.prompts, 0),
        responses: group.reduce((sum, item) => sum + item.responses, 0)
      };
    });
    renderRows(byId("origins"), sourceRows, [["source"], ["sessions", true], ["prompts", true], ["responses", true]], "Sem sessões locais.");

    const employeeRows = [...new Set(sessions.map((session) => session.collaborator_code))].map((code) => {
      const group = sessions.filter((session) => session.collaborator_code === code);
      return { code, identity: "Inferido", sessions: group.length,
        events: group.reduce((sum, item) => sum + item.messages, 0) };
    });
    renderRows(byId("employees"), employeeRows, [["code"], ["identity"], ["sessions", true], ["events", true]], "Sem colaborador local.");

    function filteredEvents() {
      const code = byId("filter-code").value.trim().toLocaleLowerCase();
      if (!code) return [];
      return events.filter((event) => event.collaborator_code.toLocaleLowerCase() === code);
    }

    function renderEvents() {
      const filtered = filteredEvents();
      const start = page * pageSize;
      const visible = filtered.slice(start, start + pageSize);
      const results = byId("interaction-results");
      results.replaceChildren();
      for (const event of visible) {
        const article = document.createElement("article");
        article.className = "interaction";
        const header = document.createElement("header");
        const identity = document.createElement("span");
        const collaborator = data.report.collaborator_code === "COLAB-000"
          ? "Eduardo Sobreira Alves Pires · IA" : "Colaborador local · IA";
        identity.textContent = `${collaborator} · ${event.collaborator_code} · ${event.source_app}`;
        const timestamp = document.createElement("time");
        timestamp.textContent = event.session_started_at ? new Date(event.session_started_at).toLocaleString("pt-BR") : "Data da sessão indisponível";
        if (event.session_started_at) timestamp.dateTime = event.session_started_at;
        header.append(identity, timestamp);
        const title = document.createElement("h3");
        title.textContent = event.event_type === "prompt" ? "Prompt" : "Resposta";
        const content = document.createElement("p");
        content.textContent = event.content;
        article.append(header, title, content);
        results.append(article);
      }
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "Nenhuma interação encontrada com esses filtros.";
        results.append(empty);
      }
      const pages = Math.ceil(filtered.length / pageSize);
      byId("interaction-pagination").hidden = pages <= 1;
      byId("search-page").textContent = `${filtered.length ? start + 1 : 0}–${Math.min(start + visible.length, filtered.length)} de ${numberFormat.format(filtered.length)}`;
      byId("search-previous").disabled = page === 0;
      byId("search-next").disabled = page + 1 >= pages;
    }

    byId("filter-code").value = data.report.collaborator_code;
    byId("filters").addEventListener("submit", (event) => { event.preventDefault(); page = 0; renderEvents(); });
    byId("search-previous").addEventListener("click", () => { page = Math.max(0, page - 1); renderEvents(); });
    byId("search-next").addEventListener("click", () => { page += 1; renderEvents(); });
    renderEvents();
  </script>
</body>
</html>'''


@contextmanager
def _open_rollout(path: Path) -> Iterator[TextIO]:
    if path.suffix != ".zst":
        with path.open("r", encoding="utf-8", errors="replace") as stream:
            yield stream
        return
    process = subprocess.Popen(
        ["node", "-e", _ZSTD_JS, str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    try:
        yield process.stdout
    finally:
        process.stdout.close()
        if process.wait() != 0:
            raise RuntimeError("Node.js não conseguiu descompactar um rollout .zst")


def _session_metadata(stream: TextIO) -> dict:
    first = stream.readline()
    try:
        row = json.loads(first)
    except (json.JSONDecodeError, TypeError):
        row = {}
    payload = row.get("payload", {}) if isinstance(row, dict) else {}
    if not isinstance(payload, dict):
        payload = {}
    return {"first_line": first, "payload": payload, "row": row}


def _is_subagent(meta: dict) -> bool:
    source = meta.get("source")
    return (isinstance(source, dict) and "subagent" in source) or meta.get("thread_source") == "subagent"


def _rollouts(root: Path) -> list[Path]:
    found = []
    for directory, subdirs, names in os.walk(root, followlinks=False):
        subdirs[:] = [name for name in subdirs if not (Path(directory) / name).is_symlink()]
        for name in names:
            path = Path(directory) / name
            if name.startswith("rollout-") and (name.endswith(".jsonl") or name.endswith(".jsonl.zst")) and not path.is_symlink():
                found.append(path)
    return sorted(found)


def _metadata_sessions(directory: Path) -> set[str]:
    if not directory.is_dir():
        return set()
    return {p.stem for p in directory.glob("*.toml") if p.is_file() and not p.is_symlink()}


def _read_rollout(path: Path) -> tuple[dict, dict | None, bool]:
    with _open_rollout(path) as stream:
        meta = _session_metadata(stream)
        payload = meta["payload"]
        if _is_subagent(payload):
            for _ in stream:
                pass
            return payload, None, True
        result = normalize_lines(chain([meta["first_line"]], stream), include_content=True)
    return payload, result, False


def _file_state(path: Path) -> tuple[int, int]:
    info = path.stat(follow_symlinks=False)
    return info.st_size, info.st_mtime_ns


def build_analytics(root: Path, collaborator_code: str) -> dict:
    root = root.resolve()
    computer_use = _metadata_sessions(root.parent / "computer-use" / "sessions")
    browser = _metadata_sessions(root.parent / "browser" / "sessions")
    sessions = []
    totals = Counter()
    primary_count = subagent_count = compressed_count = unstable_count = 0
    errors = Counter()

    for path in _rollouts(root):
        result = None
        payload = {}
        is_subagent = False
        for attempt in range(2):
            try:
                before = _file_state(path)
                payload, result, is_subagent = _read_rollout(path)
                after = _file_state(path)
            except (OSError, UnicodeError, RuntimeError) as exc:
                errors[type(exc).__name__] += 1
                result = None
                break
            if is_subagent:
                subagent_count += 1
                break
            if before == after:
                primary_count += 1
                compressed_count += path.suffix == ".zst"
                break
            result = None
            if attempt == 1:
                unstable_count += 1
                errors["changed_during_read"] += 1
        if is_subagent or result is None:
            continue

        thread_id = payload.get("session_id") or payload.get("id")
        if not isinstance(thread_id, str):
            thread_id = next((m.get("thread_id") for m in result["messages"] if m.get("thread_id")), None)
        source = payload.get("source")
        source_label = source if isinstance(source, str) else "unknown"
        originator = payload.get("originator") if isinstance(payload.get("originator"), str) else "unknown"
        source_app = (
            "Codex CLI (TUI)" if originator == "codex-tui" else
            "Codex Desktop" if originator in {"Codex Desktop", "codex_work_desktop"} else originator
        )
        started_at = payload.get("timestamp") if isinstance(payload.get("timestamp"), str) else None
        thread_turns = {t["turn_id"]: t for t in result["turns"]}
        attachment_types: dict[str, Counter] = {}
        for observation in result["observations"]:
            ref = observation.get("content_ref")
            if ref:
                for kind, count in observation.get("attachment_kinds", {}).items():
                    attachment_types.setdefault(ref, Counter())[kind] += count
        events = []
        for message in result["messages"]:
            text = "\n".join(part["text"] for part in message["text_parts"])
            if not text:
                continue
            turn_id = message.get("turn_id")
            turn = thread_turns.get(turn_id, {})
            content_id = message["content_id"]
            events.append({
                "event_id": f"{thread_id or path.stem}:{content_id}",
                "event_type": "prompt" if message["role"] == "user" else "response",
                "platform": "codex_local",
                "source_app": source_app,
                "role": message["role"],
                "content": text,
                "thread_id": thread_id,
                "turn_id": turn_id,
                "collaborator_code": collaborator_code,
                "identity_status": "locally_registered_inferred",
                "capture_status": turn.get("task_state", "unassigned"),
                "sources": sorted({item["source"] for item in message["source_occurrences"]}),
                "source_ordinals": sorted({item["ordinal"] for item in message["source_occurrences"]}),
                "attachment_kinds": dict(attachment_types.get(content_id, {})),
                "compaction_context": turn.get("compaction_context", "unknown"),
            })
        events.sort(key=lambda event: min(event["source_ordinals"], default=0))
        local_context = []
        if thread_id and thread_id in computer_use:
            local_context.append("computer-use metadata")
        if thread_id and thread_id in browser:
            local_context.append("browser metadata")
        sessions.append({
            "thread_id": thread_id,
            "collaborator_code": collaborator_code,
            "identity_status": "locally_registered_inferred",
            "originator": originator,
            "source_app": source_app,
            "source_label": source_label,
            "started_at": started_at,
            "local_context": local_context,
            "messages": len(events),
            "prompts": sum(event["role"] == "user" for event in events),
            "responses": sum(event["role"] == "assistant" for event in events),
            "tool_calls": len(result["tool_calls"]),
            "mcp_calls": len(result["mcp_tool_calls"]),
            "compacted": bool(result["summary"]["compacted_ordinals"]),
            "events": events,
        })
        totals.update({
            "messages": len(events),
            "prompts": sum(event["role"] == "user" for event in events),
            "responses": sum(event["role"] == "assistant" for event in events),
            "tool_calls": len(result["tool_calls"]),
            "mcp_calls": len(result["mcp_tool_calls"]),
        })
        totals["compacted_sessions"] += bool(result["summary"]["compacted_ordinals"])
        totals["unknown_records"] += sum(result["summary"]["unknown_type_counts"].values())
        totals["invalid_lines"] += len(result["summary"]["invalid_ordinals"])

    sessions.sort(key=lambda session: (session["started_at"] or "", session["thread_id"] or ""), reverse=True)
    origins = sorted({session["source_app"] for session in sessions})
    return {
        "report": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "schema_version": "governanca-local-analytics/1",
            "primary_rollouts": primary_count,
            "subagent_rollouts_excluded": subagent_count,
            "compressed_rollouts": compressed_count,
            "unstable_rollouts_skipped": unstable_count,
            "rollout_read_errors": dict(errors),
            "collaborator_code": collaborator_code,
            "identity_status": "locally_registered_inferred",
            "source_root_label": ".codex/sessions",
            "computer_use_metadata_files": len(computer_use),
            "browser_metadata_files": len(browser),
        },
        "summary": {**totals, "sessions": len(sessions), "origins": origins,
                    "origin_counts": dict(Counter(s["source_app"] for s in sessions)),
                    "local_context_links": sum(bool(s["local_context"]) for s in sessions),
                    "unknown_records": totals["unknown_records"],
                    "local_context_counts": dict(Counter(
                        context for session in sessions for context in session["local_context"]
                    ))},
        "sessions": sessions,
    }


def write_dashboard(data: dict, output: Path) -> None:
    encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    encoded = encoded.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    analytics_html = Path(__file__).resolve().parent.parent / "analytics" / "index.html"
    source = analytics_html.read_text(encoding="utf-8")
    style = re.search(r"<style>(.*?)</style>", source, re.DOTALL)
    if not style:
        raise RuntimeError("Não foi possível reutilizar o tema do analytics existente")
    html = _HTML.replace("__STYLE__", style.group(1)).replace("__DATA__", encoded)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")


def write_report(data: dict, output: Path) -> None:
    report, summary = data["report"], data["summary"]
    origins = ", ".join(f"{name}: {count}" for name, count in summary["origin_counts"].items())
    contexts = ", ".join(f"{name}: {count}" for name, count in summary["local_context_counts"].items()) or "nenhum vínculo por ID"
    lines = [
        "# Análise local de sessões Codex",
        "",
        f"Gerado em: {report['generated_at']}",
        f"Rollouts instaveis ignorados apos duas leituras: {report['unstable_rollouts_skipped']}.",
        "",
        "## Escopo e resultado",
        "",
        f"- Rollouts principais: {report['primary_rollouts']} ({report['compressed_rollouts']} comprimidos).",
        f"- Rollouts de subagentes excluídos: {report['subagent_rollouts_excluded']}.",
        f"- Sessões com mensagens: {summary['sessions']}; prompts: {summary['prompts']}; respostas: {summary['responses']}.",
        f"- Chamadas de ferramenta: {summary['tool_calls']}; chamadas MCP: {summary['mcp_calls']}.",
        f"- Sessões com marcador de compactação: {summary['compacted_sessions']}.",
        f"- Registros de tipo desconhecido: {summary['unknown_records']}; linhas inválidas: {summary['invalid_lines']}.",
        f"- Origem do aplicativo normalizada: {origins or 'não identificada'}.",
        f"- Metadados de computer-use/browser ligados pelo ID de thread: {contexts}.",
        f"- Arquivos TOML inventariados: computer-use {report['computer_use_metadata_files']}; browser {report['browser_metadata_files']}.",
        "",
        "## Identidade e retenção",
        "",
        "Cada evento usa `platform=codex_local`, `source_app`, `thread_id`, `turn_id`, `collaborator_code`, `identity_status`, `capture_status`, fontes/ordinais, metadados de tipo de anexo e texto. A busca é pelo código do colaborador; o resultado mostra nome, departamento, código, aplicativo de origem e data, sem expor thread, turno ou estado de captura.",
        "",
        f"O código exibido é `{report['collaborator_code']}` com estado `{report['identity_status']}`. O código vem do único registro local de atribuição, mas não há vínculo direto entre esse registro e cada rollout; trate a atribuição como inferida.",
        "A página HTML retém texto de prompts e respostas de todos os rollouts principais processados. Ela é local e não envia dados ao backend. Argumentos/saídas de ferramentas, mensagens developer, nomes/conteúdo de anexos e payloads desconhecidos foram omitidos pelo normalizador existente.",
        "",
        "## Limitações observadas",
        "",
        "- O originator `codex-tui` foi normalizado como Codex CLI (TUI); o campo `source` pode variar entre `cli` e `vscode` mesmo para essa interface de terminal. A origem `Codex Desktop` permanece separada.",
        "- A contagem de ferramenta mede ocorrências projetadas pelo normalizador, não necessariamente ações concluídas com sucesso.",
        "- `unknown_records` indica tipos sem interpretação no schema atual; não foi feita análise de seus payloads.",
        "- Os horários de mensagens individuais não foram inferidos; a data apresentada é o timestamp de início da sessão.",
        "- A associação entre extensão web e sessões locais não foi tentada nesta análise offline.",
        "- A varredura não é um snapshot atômico: cada arquivo processado foi conferido por tamanho/mtime, mas a pasta pode mudar entre arquivos.",
        "",
        "## Arquivo gerado",
        "",
        "`analytics-local.html` (contém o texto retido; abrir localmente no navegador).",
        "",
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rollout-root", type=Path,
                        default=Path.home() / ".codex" / "sessions")
    parser.add_argument("--collaborator-code", required=True)
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).parent / "analise" / "analytics-local.html")
    parser.add_argument("--report", type=Path,
                        default=Path(__file__).parent / "analise" / "relatorio-analytics-local.md")
    args = parser.parse_args()
    if not args.collaborator_code or len(args.collaborator_code) > 64:
        parser.error("--collaborator-code deve conter de 1 a 64 caracteres")
    try:
        data = build_analytics(args.rollout_root, args.collaborator_code)
        write_dashboard(data, args.output)
        write_report(data, args.report)
    except (OSError, RuntimeError) as exc:
        print(f"Falha ao gerar analytics: {type(exc).__name__}", file=sys.stderr)
        return 2
    print(json.dumps({"output": str(args.output.resolve()), "report_file": str(args.report.resolve()),
                      "summary": data["summary"],
                      "report": data["report"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
