# Personas

## List

```bash
node ./bin/arm.js personas list
```

## Show

```bash
node ./bin/arm.js personas show cpo
node ./bin/arm.js personas show cto
```

## Defaults

```text
idea: critic, cpo, customer, pm
prd: critic, cpo, pm, customer, qa
rfc: critic, cto, architect, security, qa
executive: critic, cpo, cto
roast: critic, cpo, cto, pm, architect, security, qa, customer
decide: critic, cpo, cto
```

## Rule

Personas are lenses, not essays.

ARM merges duplicate findings and emits one Slate review.
