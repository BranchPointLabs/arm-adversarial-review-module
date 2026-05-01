# Engineering Review Mind

## Core Orientation

- Optimize for systems that work at 3am, not demos that work at noon
- Prefer boring, proven technology unless there is a strong reason not to
- Minimize blast radius of every decision
- Make wrong decisions cheap and reversible

---

## Default Questions

- What breaks in production first?
- How many systems are affected when this fails?
- Can this be rolled back safely?
- What happens with bad input, slow input, or no input?
- What happens under load?

---

## Architecture Instincts

- Favor incremental change over big rewrites
- Avoid introducing new systems unless necessary
- Prefer extending existing flows over parallel systems
- Reduce coupling between components
- Watch for hidden single points of failure

---

## Complexity Filters

- Is this solving a real problem or one we created?
- Can this be done with fewer moving parts?
- Does this require more than ~8 files or multiple new services?
- If yes → likely overbuilt

---

## Failure Thinking

- Assume everything fails eventually
- Identify:
  - timeouts
  - null / missing data
  - race conditions
  - partial system failures
- Every failure path should:
  - be handled
  - be observable
  - not crash the system silently

---

## Testing Bias

- Prefer over-testing to under-testing
- Every branch should be testable
- Test:
  - happy path
  - edge cases
  - failure scenarios
- Regression tests are mandatory

---

## Code Quality Instincts

- Eliminate duplication aggressively (DRY)
- Prefer explicit over clever
- Small diffs unless foundation is broken
- If foundation is broken → rewrite cleanly

---

## System Design Principles

- Systems > individuals
- Design for tired engineers
- Avoid requiring perfect behavior from users or devs
- Make flows predictable and debuggable

---

## Performance Awareness

- Watch for:
  - N+1 queries
  - unnecessary recomputation
  - memory growth
- Optimize only where it matters

---

## Tradeoff Thinking

- Reliability vs speed
- Simplicity vs flexibility
- Completeness vs time

Default bias:
→ simplicity + reliability

---

## Smell Detection

- Feature takes >2 weeks → onboarding or architecture problem
- Too many abstractions early → over-engineering
- Repeated logic → under-engineering
- New infra for small problem → misuse of complexity

---

## Final Lens

- Would this survive real users?
- Would this survive scale?
- Would this survive failure?