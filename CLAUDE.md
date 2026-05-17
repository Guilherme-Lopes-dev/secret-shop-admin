# Engineering Principles & Coding Standards

## Philosophy

Write code that is:

- Flat
- Predictable
- Readable
- Composable
- Maintainable
- Testable
- Low in cognitive complexity

The goal is simple:

> Code should feel obvious.

---

# Core Principles

## Prefer Early Returns

Always use guard clauses to keep functions flat.

Avoid:

```ts
function process(user) {
  if (user) {
    if (user.active) {
      if (user.hasPermission) {
        return execute()
      }
    }
  }
}
```

Prefer:

```ts
function process(user) {
  if (!user) return
  if (!user.active) return
  if (!user.hasPermission) return

  return execute()
}
```

## Avoid else

Use early returns instead of nested branches.

Avoid:

```ts
if (success) {
  return data
} else {
  return fallback
}
```

Prefer:

```ts
if (success) return data

return fallback
```

## Keep Functions Small

Rules:

- One responsibility per function
- Prefer functions under 20 lines
- Extract aggressively
- Use descriptive names

Avoid giant procedural blocks.

## Keep Nesting Depth Low

Maximum recommended nesting depth: **1 level**

If nesting increases:

- Extract function
- Use guard clauses
- Invert conditions
- Return early

## Prefer Composition Over Condition Trees

Avoid:

```ts
if (type === 'pix') return pix()
if (type === 'card') return card()
if (type === 'crypto') return crypto()
```

Prefer:

```ts
const handlers = {
  pix,
  card,
  crypto
}

return handlers[type]?.()
```

## Prefer Polymorphism Over Type Checking

Avoid:

```ts
if (animal.type === 'dog') ...
if (animal.type === 'cat') ...
```

Prefer:

```ts
animal.makeSound()
```

## Prefer Declarative Code

Avoid imperative loops when possible.

Avoid:

```ts
const result = []

for (const item of items) {
  if (item.active) {
    result.push(item)
  }
}
```

Prefer:

```ts
const result = items.filter(item => item.active)
```

## Avoid Boolean Flags

Avoid:

```ts
createUser(data, true, false)
```

Prefer:

```ts
createAdminUser(data)
createGuestUser(data)
```

## Tell, Don't Ask

Avoid external decision orchestration.

Avoid:

```ts
if (user.isPremium()) {
  user.applyPremiumDiscount()
}
```

Prefer:

```ts
user.applyBenefits()
```

## Code Calisthenics

Follow these rules whenever possible:

- One level of indentation per method
- Don't use else
- Wrap primitive types
- First-class collections
- One dot per line
- Don't abbreviate names
- Keep entities small
- No classes with more than 2 instance variables
- No unnecessary getters/setters

---

# Preferred Patterns

## Guard Clauses

```ts
if (!user) return
if (!user.active) return
if (!user.email) return
```

## Functional Dispatch

```ts
const handlers = {
  pending: handlePending,
  approved: handleApproved,
  rejected: handleRejected
}

return handlers[status]?.(payload)
```

## Composition

Prefer:

```ts
pipe(
  validate,
  sanitize,
  transform,
  persist
)
```

Instead of large procedural flows.

---

# Architecture Guidelines

Prefer:

- Stateless services
- Pure functions
- Immutable data
- Composition
- Feature-based structure
- Vertical slicing

Avoid:

- God classes
- Massive services
- Deep inheritance
- Shared mutable state
- Utility dumping grounds

---

# Clean Code Expectations

Generated code must:

- Be self-explanatory
- Use intention-revealing names
- Require minimal comments
- Avoid dead code
- Avoid speculative abstractions
- Favor readability over cleverness

---

# Mandatory Standards

Every generated implementation should:

- Use early returns
- Use guard clauses
- Avoid nested if/else
- Reduce branching
- Keep cognitive complexity low
- Extract complexity immediately
- Keep functions focused
- Keep logic visually flat

---

# Golden Rule

If the code starts feeling difficult to read:

- Extract it
- Flatten it
- Simplify it
- Rename it

> Clean code is obvious code.
