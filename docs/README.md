# CnC-TA Suite Framework v1.1.0

## Start here

CnC-TA Suite Framework is the foundation used to run separate modules inside the browser version of **Command & Conquer: Tiberium Alliances**.

The Framework is not one large gameplay script. It is the system underneath the scripts. It starts the extension, waits for the game to become ready, creates shared tools, finds installed modules, checks whether they are compatible, and then loads them in a controlled way.

The Framework is versioned independently from every module.

```text
Framework version: 1.1.0
Module A version:   0.3.0
Module B version:   2.1.4
Module C version:   0.1.0
```

Those numbers do not need to match. A module only needs to support the Framework API and Hub API versions it declares.

## What is included in this release?

The Framework release includes three required control modules:

- **Suite Dashboard** — shows a general overview of the Framework, installed modules, base information, and status.
- **Module Manager** — lists installed modules and allows them to be enabled, disabled, or opened.
- **Suite Status** — shows framework health, compatibility, performance, and lifecycle diagnostics.

These three modules are part of the basic Framework experience. They prove that the Framework is running and give the user a way to view and manage it. They are not gameplay feature modules such as an attack planner, scanner, upgrade tool, or resource tool.

The complete CnC-TA-Suite distribution currently bundles 26 independently versioned modules. Current highlights include Player Intelligence, Alliance Intelligence and markers, Scanner saved-layout and silo filtering, War Room native simulation, Research ETA, and manual economy/repair tools. Each feature module remains independently versioned and documented even when distributed with the Framework.

## Who are these documents for?

These documents are written for two groups:

1. People who do not write code but want to understand what the Framework is doing.
2. Developers who need a clear starting point before reading the source code.

You do not need to understand every JavaScript file to understand the design. The documents begin with plain-language explanations and gradually introduce the technical details.

## Recommended reading order

1. [What Is the Framework?](01%20-%20Introduction/What%20Is%20the%20Framework.md)
2. [Framework Goals and Boundaries](01%20-%20Introduction/Framework%20Goals%20and%20Boundaries.md)
3. [Included Control Modules](01%20-%20Introduction/Included%20Control%20Modules.md)
4. [Installation and First Run](02%20-%20Installing%20and%20Running/Installation%20and%20First%20Run.md)
5. [Startup Process](03%20-%20How%20the%20Framework%20Works/Startup%20Process.md)
6. [Module System](05%20-%20Modules%20and%20Compatibility/Module%20System.md)
7. [Versioning and Compatibility](05%20-%20Modules%20and%20Compatibility/Versioning%20and%20Compatibility.md)
8. [Building a Module](06%20-%20Development/Building%20a%20Module.md)

## The simplest explanation

Think of the Framework as a power strip.

The power strip does not decide what each appliance does. It provides a safe, shared place for appliances to connect. A lamp, television, fan, or charger may all use the same power strip while remaining separate products.

In this comparison:

- The **Framework** is the power strip.
- **Shared services** are the outlets.
- **Modules** are the appliances.
- A **module manifest** is the label showing what the appliance needs.
- **Permissions** decide which outlets the module may use.
- **Compatibility checks** make sure the plug fits before power is supplied.

The Framework can still exist with nothing plugged into it. That is an important part of the design.

## Source of truth

The source code is the defining source for how the Framework operates. These documents explain the code, but they do not replace it.

When the code changes, the documents should be updated to match the code. Module documentation belongs inside the module and should be updated when that module changes.

## Current release information

- Framework version: **1.1.0**
- Framework release label: **v1.1.0-release**
- Chrome extension manifest version: **1.1.0**
- Suite API version: **1.1.0**
- Game Data Hub API version: **1.0.0**
- Browser extension standard: **Chrome Manifest V3**
