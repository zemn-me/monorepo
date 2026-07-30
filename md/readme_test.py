import unittest

from md.readme import render


class RenderTest(unittest.TestCase):
    def test_replaces_annotated_fence_and_preserves_metadata(self) -> None:
        template = """Before
```typescript file=examples/basic.ts title="Basic example" replace=internal:public
stale
```
After
"""
        self.assertEqual(
            render(template, {"examples/basic.ts": "const answer = internal;\n"}),
            """Before
```typescript file=examples/basic.ts title="Basic example"
const answer = public;
```
After
""",
        )

    def test_leaves_unannotated_fence_alone(self) -> None:
        template = "```bash\nnpm install example\n```"
        self.assertEqual(render(template, {}), template)

    def test_rejects_missing_example(self) -> None:
        with self.assertRaisesRegex(ValueError, "no example input"):
            render("```ts file=examples/missing.ts\n```", {})


if __name__ == "__main__":
    unittest.main()
