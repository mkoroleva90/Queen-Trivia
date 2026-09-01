---
name: Provider abuse controls
description: Security requirements for metering and throttling external provider operations.
---

External AI usage must be reserved durably and atomically after local validation but before starting provider work. Serialize reservations per authenticated host so concurrent requests across replicas cannot all pass the same quota check.

Provider endpoint rate limits must use a shared store, key authenticated traffic by host account rather than source IP, and fail closed when the shared counter or durable usage reservation is unavailable.

**Why:** Check-then-record metering and in-process, IP-only counters allow distributed concurrent requests to exceed paid-provider quotas in autoscaled deployments.

**How to apply:** Any new route that can invoke a paid or quota-limited provider must reserve usage immediately before the call and use a namespaced shared limiter tied to the authenticated account.