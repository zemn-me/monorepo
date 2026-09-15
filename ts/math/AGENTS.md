# Shared rendering APIs

`wireframe_render.ts` has consumers under `project/` as well as `ts/`. Keep the object-based `styleSegment`/`renderSegments` contract distinct from the Church-encoded `wireSegment`/`projectSegments` path. Validate shared API changes against the Baby, Lulu, and zemn.me production builds; their prerendering executes scene code.
