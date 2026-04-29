# Config

ARM reads:

```text
arm.config.yaml
```

## Key Settings

```yaml
backend:
  default: heuristic
  model: null

output:
  default_path: docs/arm
  max_words:
    idea: 500
    prd: 800
    rfc: 900
    executive: 700
    roast: 1200
    decide: 300
```

## Command Personas

```yaml
commands:
  review_idea:
    personas: [critic, cpo, customer, pm]
  review_roast:
    personas: [critic, cpo, cto, pm, architect, security, qa, customer]
```

## Validate

```bash
node ./bin/arm.js validate
```
