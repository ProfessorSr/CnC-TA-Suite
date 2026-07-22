# Resource Transfer Manager

Manual-only resource transfer planning for owned bases.

Features:

- current or selected destination base
- individual, multiple, or all source-base selection
- Tiberium and Crystal transfers at 10%, 25%, 50%, 75%, or 100%
- destination-base-specific Quick Transfer profiles for all resources, Crystal only, Tiberium only, or custom percentages of each resource from every other eligible owned base
- configurable resource reserve retained at every source
- trade-eligibility and Credit-cost validation; destination storage is informational because owned bases may hold transferred resources above nominal capacity
- optional confirmation before bulk transfers
- manual transfer history
- preferred Supplies tab
- reversible disabling of Funds-related controls while Supplies is open

The profile belonging to the currently open base is used when the Quick Transfer icon is clicked. Native `SelfTrade` commands are submitted sequentially and each must complete successfully before the next source/resource transfer is sent.

The module never schedules, balances, or triggers transfers automatically. Every `SelfTrade` command follows an explicit click in the module. Funds protection changes only visible Qooxdoo controls and does not patch ClientLib inventory methods.
