# Turno — API local em Go

Backend real da demonstração Turno: regras de escala calculadas no servidor, API HTTP, revisões otimistas e persistência em arquivo. Usa apenas a biblioteca padrão do Go; não requer banco de dados, serviço pago, conta ou credencial. Todos os dados são fictícios.

## Executar

Requisito: Go 1.22+ (o comando precisa ser o compilador Go, não outro aplicativo homônimo).

```sh
# Na raiz do projeto, preparar o frontend:
npm run build
cd backend

go run . -addr 127.0.0.1:8080 -data data/week.json -web ../dist
# Abra http://127.0.0.1:8080/?mode=api
```

Sem `?mode=api`, o frontend permanece no modo de demonstração local no navegador. Não há migração ou upload automático entre os dois modos. O modo API funciona quando servido pelo backend Go; GitHub Pages hospeda somente a versão estática.

```sh
go test -race -cover ./...
go vet ./...
go build -o turno .
```

O detector de corridas requer uma plataforma compatível e compilador C disponível. A aplicação normal não usa CGo. Caso o diretório de cache padrão não seja gravável, configure `GOCACHE` e `GOPATH` para diretórios locais graváveis — não é necessário alterar permissões do sistema.

## Modelo e regras

- Uma semana fixa: `2026-11-02`. Quatro pessoas: `ana`, `bruno`, `clara`, `davi`.
- `assignments`: um array de sete turnos por pessoa; valores `off`, `morning`, `afternoon`.
- `availability`: mapa por pessoa e dia (chaves `"0"` a `"6"`) com os turnos **indisponíveis**. Ausência do dia ou array vazio significa disponibilidade completa.
- Cada turno tem oito horas; o limite de 40 horas gera um alerta. Não é validação trabalhista.
- Atribuições indisponíveis geram conflitos e **não contam** para a cobertura; suas horas continuam como horas planejadas.
- A meta é uma pessoa disponível por turno, totalizando 14 turnos na semana.
- Conflitos são retornados como códigos estruturados, para tradução pelo frontend; uma escala com conflitos pode ser salva para simulação.

## API

Prefixo: `/api/weeks/2026-11-02`. Todas as mutações exigem a revisão atual; requisições com corpo usam `Content-Type: application/json`.

| Método | Recurso | Corpo/consulta |
|---|---|---|
| GET | `/api/health` | Estado do processo, sem detalhes do disco |
| GET | prefixo | Lê estado e relatório calculado |
| PUT | prefixo | `{ "revision": 1, "assignments": {...}, "availability": {...} }` substitui toda a semana |
| PATCH | `prefixo/assignments` | `{ "revision": 1, "personId": "davi", "day": 6, "shift": "afternoon" }` cria/atualiza uma atribuição |
| DELETE | `prefixo/assignments/davi/6?revision=2` | Remove a atribuição, voltando a `off` |
| PUT | `prefixo/availability` | `{ "revision": 3, "personId": "davi", "day": 6, "shifts": ["afternoon"] }` substitui os turnos indisponíveis do dia; `[]` limpa |
| POST | `prefixo/reset` | `{ "revision": 4 }` restaura dados fictícios, sem zerar a revisão |

Exemplo:

```sh
curl http://127.0.0.1:8080/api/weeks/2026-11-02
curl -X PATCH http://127.0.0.1:8080/api/weeks/2026-11-02/assignments \
  -H 'Content-Type: application/json' \
  -d '{"revision":1,"personId":"davi","day":6,"shift":"afternoon"}'
```

Resposta de sucesso: estado completo `{version, revision, week, assignments, availability, report}`. O relatório inclui `{covered, total, totalHours, hours, coverage, conflicts}`. Conflitos têm `personId`, `type` (`availability` ou `hours`) e `day` quando aplicável.

Erros usam `{code, message, currentRevision?}`; mensagens são diagnósticos em inglês, e o frontend localiza os estados exibidos ao usuário:

- `400`: JSON inválido, propriedades desconhecidas ou valores com tipos incorretos.
- `403`: origem ou Host não permitidos.
- `404`: recurso ou semana desconhecidos.
- `405`: método não suportado, com cabeçalho `Allow`.
- `409`: revisão antiga. Recarregue, revise a alteração concorrente e então reaplique intencionalmente; não há repetição silenciosa.
- `413`: corpo acima de 64 KiB.
- `415`: tipo de conteúdo diferente de JSON.
- `422`: domínio inválido, pessoa/dia/turno desconhecido ou revisão ausente.
- `500`: gravação não confirmada; recarregue antes de tentar novamente.

## Persistência e concorrência

`Store` serializa mutações com `sync.Mutex`. A verificação da revisão, criação de cópia, validação, gravação e atualização em memória acontecem na mesma região crítica. Leitores recebem cópias independentes. Duas requisições na mesma revisão não podem sobrescrever uma à outra: apenas uma vence e a outra recebe 409. Repetir uma requisição já confirmada com a mesma revisão também retorna 409, sem repetir a gravação.

A gravação cria um arquivo temporário **no mesmo diretório**, escreve todo o JSON, sincroniza o arquivo, fecha e renomeia atomicamente. Antes do rename, falhas preservam o arquivo anterior e o estado em memória. O rename é o ponto de commit. A sincronização do diretório é tentada após o commit, mas é best-effort: não há promessa de sobrevivência a perda de energia em sistemas de arquivos que não suportem esse fsync. Não use diretórios de rede ou sincronizados por outros processos.

Um arquivo `week.json.lock`, criado exclusivamente, impede abrir duas instâncias sobre o mesmo caminho. SIGINT/SIGTERM provocam shutdown HTTP e remoção do lock. Após encerramento abrupto, um lock pode ficar abandonado: **confirme que nenhuma instância ainda usa o arquivo antes de removê-lo manualmente**. Não há recuperação automática de lock, alta disponibilidade, backups automáticos ou transações distribuídas. O mecanismo não coordena caminhos alternativos/symlinks para o mesmo arquivo; use sempre o mesmo caminho canônico, sem aliases.

Arquivo existente inválido faz a inicialização falhar; nunca é sobrescrito silenciosamente pelo exemplo. Dados e lock usam permissão `0600`; o diretório criado usa `0700`. Isso não substitui criptografia, permissões adequadas do diretório pai ou backup.

## Segurança e limites

Este é um **servidor de demonstração local sem autenticação**. O endereço de escuta deve ser loopback, o Host deve ser localhost/loopback e não há CORS. Mutações rejeitam `Origin` incompatível e `Sec-Fetch-Site: cross-site`; clientes de linha de comando sem Origin continuam permitidos. Não exponha por túnel, proxy público ou porta compartilhada. Não use dados reais de empregados.

Há limites de corpo/cabeçalhos e timeouts HTTP. A decodificação rejeita campos desconhecidos e JSON extra; como o decoder padrão do Go, chaves JSON duplicadas usam o último valor. A validação final ainda precisa passar. Não é uma plataforma de RH, nem possui login, permissões por usuário, auditoria imutável, otimização automática ou validação legal.

## Testes

Os testes exercitam a API via `httptest` e servidor TCP HTTP real, armazenamento em diretórios temporários, reinicialização, lock concorrente, arquivo corrompido, falha de gravação simulada, isolamento de cópias, limites/validação HTTP e doze atualizações simultâneas com a mesma revisão. `go test -race` verifica acesso concorrente em memória durante esses cenários.

## English

A real local Go backend, not a mock API: server-side schedule rules, optimistic revisions, atomic JSON-file persistence, HTTP integration and race tests. Run `go run . -web ../dist`, then open `http://127.0.0.1:8080/?mode=api`. It deliberately supports one fictional week and four fictional people. No authentication, production hosting, labor-law validation or real employee data. GitHub Pages remains a separate browser-only demo.

## 日本語

Goで実装した実際のローカルAPIです。シフトのルールをサーバー側で計算し、リビジョンによる競合検出、JSONファイルへの保存、HTTP統合テストと競合検出テストを備えています。`go run . -web ../dist` を実行し、`http://127.0.0.1:8080/?mode=api` を開いてください。対象は架空の1週間と4人に限定しています。認証・本番運用・労働法への適合性検証は対象外です。実在する従業員の情報は入力しないでください。GitHub Pagesでは別のブラウザ内デモを使用します。
