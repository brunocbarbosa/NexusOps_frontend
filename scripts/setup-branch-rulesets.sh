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
# `sonar` entra na lista sabendo que ele só roda com SONAR_ENABLED=true.
# Medido no PR #1: sem a variable o job reporta `conclusion=skipped`, e o
# GitHub conta *skipped* como satisfeito num check obrigatório — ou seja, o
# check fica verde SEM ter analisado nada. Verde por ausência, não por
# qualidade. Manter a variable ligada é o que dá sentido a esta linha.
CHECKS=(quality e2e sonar commits branch-policy codeql audit secrets)

# `dependency-review` fica de fora da lista: só existe em evento de PR, e em
# push de merge ele nunca reporta.

checks_json() {
  printf '%s\n' "${CHECKS[@]}" | python3 -c '
import json, sys
print(json.dumps([{"context": c.strip()} for c in sys.stdin if c.strip()]))'
}

ruleset_payload() {
  local name="$1" branch="$2" linear="$3"
  python3 - "$name" "$branch" "$linear" "$(checks_json)" <<'PY'
import json, sys
name, branch, linear, checks = sys.argv[1], sys.argv[2], sys.argv[3] == "true", json.loads(sys.argv[4])

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
            "allowed_merge_methods": ["squash", "merge"],
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
if linear:
    rules.append({"type": "required_linear_history"})

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
  local name="$1" branch="$2" linear="$3" payload id
  payload="$(ruleset_payload "$name" "$branch" "$linear")"

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

upsert "development" "development" false
upsert "main"        "main"        true

if $APPLY; then
  echo
  echo "Rulesets ativos:"
  gh api "repos/$REPO/rulesets" --jq '.[] | "  \(.name)  [\(.enforcement)]"'
  echo
  echo "ATENÇÃO: os checks só passam a ser exigíveis depois de terem reportado"
  echo "ao menos uma vez no repositório. Rode um PR antes de confiar no bloqueio."
fi
