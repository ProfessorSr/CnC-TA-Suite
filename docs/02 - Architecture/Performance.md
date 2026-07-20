# Performance

> Status: Implemented baseline for v0.4.0

Game discovery polls at bounded intervals and times out. Top-bar discovery retries every 500 ms for at most 120 attempts. Game-state monitoring is centralized; modules must subscribe rather than add duplicate polling. Shared caches reduce repeated ClientLib reads, and move/resize persistence is debounced.

Module enable work should be short and asynchronous where needed. Avoid full widget-tree scans after attachment, unbounded event history, synchronous bulk storage, and per-frame ClientLib access. New recurring work must document its interval, ownership, cleanup, and expected cost and should be checked in a live world.
