# Generated file metadata - 2026-10-14

## Network observation

A synthetic CSV was requested from ChatGPT. The UI showed `departamentos_sinteticos.csv`. CDP metadata observation recorded:

- `GET /backend-api/conversation/{id}/interpreter/download` -> `200 application/json`.
- `GET /backend-api/estuary/content` -> `200 text/csv`, with `Content-Disposition` containing `departamentos_sinteticos.csv` and no `Content-Length`.

The local SQLite database stored one `download_headers` row with the filename, MIME `text/csv`, null size, and collaborator `Eduardo`. The generated-file row has no conversation/interaction association. CDP output was filtered to omit query strings, authentication headers, and bodies.

After reloading the extension and ChatGPT tab, a second synthetic CSV (`departamentos_sinteticos_487_488.csv`) produced the same two GETs. Only `/backend-api/estuary/content` produced a stored row: `download_headers`, MIME `text/csv`, null size, collaborator `Eduardo`. No `metadata_json` artifact row appeared.

Result: `PASS` for generated-file name and MIME capture after reload; size and conversation association were not observed. The uploaded-file result is recorded below.

## Uploaded file retest

The user attached the synthetic `synthetic-document(6).txt`; the extension stored interaction `cfce805f-3d6e-48de-b021-6c367a45a3da` and one complete response. Attachment metadata was `source=visible_card`, name `synthetic-document(6).txt`, MIME null, size null, collaborator `Eduardo`, and `attachments_capture_status=observed`.

Result: `PASS` for prompt/response and filename capture; the `.txt` extension is present in the name. `FAIL` for MIME and size capture: the selection cache did not match this card, so the visible-card fallback supplied only its label. No file content was stored by the extension.

## Privacy change

The old `interpreter/download` path cloned and read up to 64 KB of JSON. That path is removed. The probe now reads only `Content-Disposition`, `Content-Type`, and `Content-Length` from `/backend-api/estuary/content`; it does not read or calculate from the body. Missing headers remain null. `metadata_json` is no longer accepted by the extension or API schema.

## Verification

- `node --test --test-isolation=none extension/tests/*.test.mjs` - PASS, 44 tests.
- `.venv/Scripts/python.exe -m pytest tests/test_machine_identity.py -k artifact_metadata_is_tied_to_machine_assignment -q -p no:cacheprovider --basetemp=data/pytest-metadados` from `backend/` - PASS, 1 test.
- `git diff --check` - PASS.

Known limit: the observed download headers did not provide file size or a conversation identifier. The CDP inspection did not read response bodies; before this change, the extension probe could temporarily read the JSON response from `interpreter/download`.
