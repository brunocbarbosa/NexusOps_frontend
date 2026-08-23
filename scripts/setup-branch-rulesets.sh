#!/usr/bin/env bash
# Aplica no GitHub a política de branches que o CLAUDE.md descreve em prosa:
#
#   - `development` é a branch de trabalho e só avança por PR.
#   - `main` é a linha de release e só recebe `development`, também por PR.
#
# A segunda metade da regra de `main` — "vindo de development" — NÃO é
# expressável em ruleset nenhum do GitHub; ela vive no job `branch-policy` do
# workflow de CI, que este script exige como check obrigatório.
#
# Uso:
#   bash scripts/setup-branch-rulesets.sh          # mostra o que faria
#   bash scripts/setup-branch-rulesets.sh --apply  # aplica
#
# Idempotente: um ruleset com o mesmo nome é atualizado, não duplicado.
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

# Checks obrigatórios. São os `name:` dos jobs em .github/workflows/, não os
# ids — o GitHub identifica o status check pelo nome exibido.
#
# **Um check pulado conta como satisfeito.** Medido: um job que o `if` pula
# reporta `conclusion=skipped`, e o GitHub trata isso como aprovado num check
# obrigatório. Exigir um check que nunca roda é pedir um verde por ausência, e
# é por isso que as duas listas abaixo diferem em vez de serem a mesma.
CHECKS_COMMON=(quality e2e commits branch-policy codeql audit secrets)

# `sonar` só na `development`. O plano da organização no SonarCloud serve dados
# apenas da branch principal do projeto, que é a `development` — um PR mirando
# `main` é recusado com
# `Organization is not allowed to access data from PR targeting non main branches`.
# O job pula nesse caso de propósito, então exigi-lo em `main` seria exigir um
# skip.
CHECKS_DEVELOPMENT=("${CHECKS_COMMON[@]}" sonar)
CHECKS_MAIN=("${CHECKS_COMMON[@]}")

# `dependency-review` fica de fora das duas: só existe em evento de PR, e em
# push de merge ele nunca reporta.

checks_json() {
  printf '%s\n' "$@" | python3 -c '
import json, sys
print(json.dumps([{"context": c.strip()} for c in sys.stdin if c.strip()]))'
}

ruleset_payload() {
  local name="$1" branch="$2" methods="$3"; shift 3
  python3 - "$name" "$branch" "$methods" "$(checks_json "$@")" <<'PY'
import json, sys
name, branch, methods, checks = sys.argv[1], sys.argv[2], sys.argv[3].split(","), json.loads(sys.argv[4])

rules = [
    {"type": "deletion"},
    {"type": "non_fast_forward"},          # bloqueia force-push
    {
        "type": "pull_request",
        "parameters": {
            # Mantenedor solo: exigir 1 aprovação trancaria todo merge, já que
            # o autor do PR não pode aprovar o próprio PR.
            "required_approving_review_count": 0,
            "dismiss_stale_reviews_on_push": True,
            "require_code_owner_review": False,
            "require_last_push_approval": False,
            "required_review_thread_resolution": True,
            "allowed_merge_methods": methods,
        },
    },
    {
        "type": "required_status_checks",
        "parameters": {
            "strict_required_status_checks_policy": True,
            "do_not_enforce_on_create": False,
            "required_status_checks": checks,
        },
    },
]
print(json.dumps({
    "name": name,
    "target": "branch",
    "enforcement": "active",
    "conditions": {"ref_name": {"include": [f"refs/heads/{branch}"], "exclude": []}},
    "rules": rules,
    # Admin do repositório mantém a saída de emergência; sem ela, uma CI
    # quebrada trancaria o próprio conserto.
    "bypass_actors": [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request"}],
}, indent=2))
PY
}

upsert() {
  local name="$1" branch="$2" methods="$3" payload id; shift 3
  payload="$(ruleset_payload "$name" "$branch" "$methods" "$@")"

  id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name==\"$name\") | .id" 2>/dev/null || true)"

  if [[ "$APPLY" != true ]]; then
    if [[ -n "$id" ]]; then
      echo ">> ATUALIZARIA o ruleset '$name' (id $id) em $REPO"
    else
      echo ">> CRIARIA o ruleset '$name' em $REPO"
    fi
    echo "$payload"
    echo
    return
  fi

  if [[ -n "$id" ]]; then
    echo ">> atualizando ruleset '$name' (id $id)"
    printf '%s' "$payload" | gh api --method PUT "repos/$REPO/rulesets/$id" --input - >/dev/null
  else
    echo ">> criando ruleset '$name'"
    printf '%s' "$payload" | gh api --method POST "repos/$REPO/rulesets" --input - >/dev/null
  fi
}

echo "Repositório: $REPO"
$APPLY || echo "(simulação — rode com --apply para valer)"
echo

# `development` aceita squash de branch de feature — colapsar o vaivém de um PR
# num commit só é ganho de leitura, e a branch de feature morre em seguida.
upsert "development" "development" "squash,merge" "${CHECKS_DEVELOPMENT[@]}"

# `main` aceita SÓ merge commit, e não exige histórico linear. Isto foi medido,
# não escolhido por gosto: `development` e `main` são as duas de vida longa, e
# squash entre branches de vida longa quebra a ancestralidade — o commit
# esmagado não existe em `development`, então o release seguinte tenta remergear
# os mesmos commits e conflita. Simulado nos 34 commits do primeiro release:
#
#   squash        -> main deixa de ser ancestral, 34 commits somem do histórico
#   merge commit  -> development fica contido em main, histórico intacto
#
# `required_linear_history` proíbe exatamente o merge commit de que este fluxo
# depende, e por isso saiu.
upsert "main"        "main"        "merge"        "${CHECKS_MAIN[@]}"

if $APPLY; then
  echo
  echo "Rulesets ativos:"
  gh api "repos/$REPO/rulesets" --jq '.[] | "  \(.name)  [\(.enforcement)]"'
  echo
  echo "ATENÇÃO: os checks só passam a ser exigíveis depois de terem reportado"
  echo "ao menos uma vez no repositório. Rode um PR antes de confiar no bloqueio."
fi
