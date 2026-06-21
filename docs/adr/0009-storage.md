# ADR-0009: Storage de objetos

- **Status:** Aceito
- **Data:** 2026-06-20

## Contexto

Necessário storage S3-compatível para documentos legais (confissão de dívida `FUTURO`), comprovantes e exports (seção 3.3, NFR-07).

## Decisão

**Cloudflare R2** (S3-compatível, sem custo de egress).

- API S3 padrão via AWS SDK.
- Buckets por ambiente (`dev`, `staging`, `prod`).
- Prefixo por tenant: `t:{tenant_id}/...`.
- Acesso via signed URLs com TTL curto (15min) para download.

## Consequências

**Positivas:**
- Sem custo de egress (vantagem crítica para exports de relatórios).
- Integração S3 padrão.
- Region configurável (americas por padrão).

**Negativas:**
- Vendor lock-in moderado (mitigado por S3-compatibilidade).
- Latência para `us-east-1` pode variar.

**Mitigação:**
- Adapter `FileStorageProvider` com interface S3 — swap trivial para AWS S3 ou GCS.
- Criptografia em repouso habilitada por padrão (R2 já oferece).
