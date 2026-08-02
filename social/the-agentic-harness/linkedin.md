# LinkedIn — The harness is the product

There’s a disappointment almost everyone building agents hits.

You wire up a model with tools. It solves something hard on the first try. Then you run it a hundred times on real inputs and it works maybe sixty — and the forty failures are not subtle model errors. Stale files. Bad tool args. The same broken command four times. Confident “done” on work it never did.

None of that is fixed by a better model. It’s the **harness**: everything around the model call — context assembly, tool surfaces, error formatting, observation, termination, budgets.

Since every team has access to roughly the same frontier models, the harness is the part that is actually yours.

I wrote down the loop, the failure modes that only show up after the demo works, and why “errors as input” beats opaque catch-and-apologize.

Read: https://kmrrohit.vercel.app/writing/the-agentic-harness

#Agents #AIEngineering #LLM
