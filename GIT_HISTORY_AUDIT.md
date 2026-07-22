# SingSong Git History Audit

Run ID: `683054d4ee774d5ea65dedb69d21145c`  
Audit date: 2026-07-22 (Asia/Seoul)  
Scope: the repository at `C:\Users\agape\Desktop\코딩\singsong`, its local object database, all local refs, the live refs advertised by `origin`, and all objects accessible to `git fsck`  
Method: read-only Git inspection; no checkout, fetch, reset, clean, stash mutation, ref update, GC, recovery write, commit, or push

This record implements the forensic-history slice of [`RELEASE_BUILD_PLAN.md`](./RELEASE_BUILD_PLAN.md). It freezes the state observed before release implementation began. Files created later by the release run, including `RELEASE_BUILD_PLAN.md` and this audit, are not part of the initial dirty-tree counts below.

## 1. Executive verdict

- The reachable product history is a valid, linear, documentation-only chain of exactly 13 commits. There is no previously committed application implementation to recover.
- `origin/main` is the empty root commit. The remote feature branch contains the next 11 product-document commits, and the local feature branch is one commit ahead with the detailed-document split.
- The initial user working tree contained 16 modified tracked documents and 46 untracked files. Nothing was staged, deleted, conflicted, or behind the upstream branch.
- A Codex tree ref, `50173b6288ba484fc40b9d6d8b16dc40497b8280`, is a byte-for-byte Git-blob snapshot of all 62 initial tracked-or-untracked user files. All 62 filesystem paths matched their expected Git blob IDs.
- `git fsck --full --no-reflogs --unreachable` found 61 accessible unreachable objects: 4 stash-shaped commits, 44 trees, and 13 blobs. The stash-shaped commits duplicate the tracked dirty state. Three raster design boards exist only in an unreachable tree, but each labels itself reference-only.
- Object integrity is sound. The only `fsck` findings are expected dangling/unreachable work snapshots; no corrupt or missing object was reported.
- No Git LFS payload, submodule, tag, replace ref, graft, note, shallow boundary, partial-clone promisor, alternate object store, sparse checkout, custom Git hook, or additional worktree exists.
- No strong secret signature or sensitive credential filename was found in any enumerated reachable or unreachable snapshot. Commit metadata contains two distinct author email identities; the values are intentionally not reproduced here.

## 2. Initial repository state

### 2.1 HEAD and upstream

| Field | Initial value |
|---|---|
| Repository root | `C:/Users/agape/Desktop/코딩/singsong` |
| Git directory/common directory | `.git` / `.git` |
| Bare | no |
| Shallow | no |
| Branch | `claude/favorite-song-app-research-vs3yqa` |
| HEAD | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a` |
| Upstream | `origin/claude/favorite-song-app-research-vs3yqa` |
| Ahead/behind | `+1 / -0` |
| Staged changes | 0 |
| Unmerged entries | 0 |
| Modified tracked paths | 16 |
| Untracked paths | 46 |
| Tracked deletions | 0 |
| Tracked diff | 892 insertions, 233 deletions |

The initial porcelain-v2 header was:

```text
# branch.oid fff4d598aebc9b501874314d6a4a1c0cd1115c9a
# branch.head claude/favorite-song-app-research-vs3yqa
# branch.upstream origin/claude/favorite-song-app-research-vs3yqa
# branch.ab +1 -0
```

All 16 tracked changes were worktree-only `.M` entries; the index versions equaled HEAD.

### 2.2 Modified tracked paths

```text
docs/BUILD_PLAN.md
docs/PRODUCT_SPEC.md
docs/README.md
docs/design/COMPONENTS.md
docs/design/DESIGN_SYSTEM.md
docs/design/MICROCOPY.md
docs/design/SCREENS.md
docs/design/UX_FLOWS.md
docs/engineering/ANALYTICS.md
docs/engineering/API_CONTRACT.md
docs/engineering/ARCHITECTURE.md
docs/engineering/PLATFORM_NOTES.md
docs/engineering/SECURITY.md
docs/prompts/ONESHOT_MASTER.md
docs/verification/QA_MATRIX.md
docs/verification/TEST_PLAN.md
```

### 2.3 Untracked paths at the initial boundary

The 46 paths were:

- `APP_FINAL_DESIGN_PLAN.md`
- `docs/CODEX_FINAL_REVIEW.md`, `docs/FINAL_BLUEPRINT.md`, `docs/UNKNOWN_REGISTER.md`
- `docs/design/VISUAL_MOTION_DIRECTION.md`
- `docs/design/assets/README.md` and six PNGs: `ticket-issue-storyboard.png`, `보관.png`, `생성된 이미지 2.png`, `순서.png`, `최종.png`, `최종2.png`
- seven files under `docs/design/concepts-10/`: `ADOPTION.md`, `README.md`, `app.js`, `index.html`, `preview.png`, `recommended-cutline.png`, `styles.css`
- eighteen files under `docs/design/ticket-concepts-10/`: `PRINCIPLES_CHECKLIST.md`, `README.md`, `app.js`, ten `exports/ticket-01.png` through `ticket-10.png`, `index.html`, `preview-mobile.png`, `preview.png`, `recommended-ledger-08.png`, `styles.css`
- eight files under `docs/design/ticket-directions/`: six numbered PNGs, `README.md`, and `TICKET_PROMPT_PRINCIPLES.md`
- `docs/prompts/ONESHOT_IMPLEMENTATION_HANDOFF_V3_2.md`

Ignored `.remember` runtime material is intentionally outside this 62-file Git snapshot. Repository `.git/info/exclude` contained comments only; the sandbox could not read the user-level `C:\Users\agape\.config\git\ignore` file.

## 3. Complete ref inventory

### 3.1 Ordinary refs

| Ref | Type | Object | Meaning |
|---|---|---|---|
| `HEAD` | symbolic | `refs/heads/claude/favorite-song-app-research-vs3yqa` | current local branch |
| `refs/heads/claude/favorite-song-app-research-vs3yqa` | commit | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a` | local tip, one commit ahead |
| `refs/remotes/origin/HEAD` | symbolic/commit | `refs/remotes/origin/claude/favorite-song-app-research-vs3yqa` / `4d108931e4e7b33d254cc2c21bd4e5d514b7b827` | remote default branch |
| `refs/remotes/origin/claude/favorite-song-app-research-vs3yqa` | commit | `4d108931e4e7b33d254cc2c21bd4e5d514b7b827` | locally recorded remote feature tip |
| `refs/remotes/origin/main` | commit | `af2ce1da7e0f05fcc5a0f47f44adfd84b1e2bcdb` | empty initialization root |

There is no local `main`, tag ref, notes ref, replace ref, or stash ref.

### 3.2 Codex tree refs

These are tool-owned tree refs, not commits or product branches. They are included because they preserve user working material.

| Full ref | Tree |
|---|---|
| `refs/codex/turn-diffs/captures/1784648491167/3d31c385-2f8f-4c09-9f6e-7df164ef8184/base` | `50173b6288ba484fc40b9d6d8b16dc40497b8280` |
| `refs/codex/turn-diffs/checkpoints/68e2e0ac99cb5208a1bfabaf0fe3263b90ceef367c3e3e0dcaea7f15d5a34da0/0248ec72b57a08ab0c1965ee8ddc53aef869ac1547fe62cb1c210ae870aee4b3/1784644746468/e9d8e9a3-1d34-43fb-83d5-cf721953e24c` | `858541b90d9ffe0712ed3eef627b706d71f7f192` |
| `refs/codex/turn-diffs/checkpoints/ac91b486badcfb23505b314066e62066d6ab979ec705112354a841ddb880fe63/c25df0a4949d3b27aa43a077f5200ae26a095f9e9a6493f91b9858868a4c58b7/1784648362662/9e2ffc9e-8e89-4a4c-b220-64e1c2063f0f` | `50173b6288ba484fc40b9d6d8b16dc40497b8280` |
| `refs/codex/turn-diffs/checkpoints/e83abb31516ef0eda1483cf9d16345c169536c55b89fc70ba003b00078c1e668/bc65d181ab3381e3de7a074e6d636aec14bbd8755794f28fee830a118633d030/1784644603787/329335a8-0e0c-465c-938d-79757f1905d0` | `858541b90d9ffe0712ed3eef627b706d71f7f192` |

Tree `858541b...` contains 62 files and 39,670,758 blob bytes. Tree `50173b...` contains 62 files and 38,420,854 blob bytes.

The transition from `858541b...` to `50173b...` records only working-material cleanup:

- `image-1784644463111.png` → `보관.png`
- `생성된 이미지 1 (1).png` → `순서.png`
- `session-strip-concept-board.png` → `최종.png`
- `생성된 이미지 1 (2).png` → `최종2.png`
- duplicate `생성된 이미지 1.png` removed
- `docs/prompts/ONESHOT_IMPLEMENTATION_HANDOFF_V3_2.md` added

These are tree-snapshot renames, not committed Git-history renames.

## 4. Remote verification

The configured remote was inspected with credentials redacted before display.

| Setting | Value |
|---|---|
| Remote | `origin` |
| Sanitized URL | `https://github.com/agape7372/singsong.git` |
| Fetch refspec | `+refs/heads/*:refs/remotes/origin/*` |
| Push URL override | none |
| Local branch remote | `origin` |
| Local branch merge ref | `refs/heads/claude/favorite-song-app-research-vs3yqa` |

An escalated but read-only `git ls-remote --symref` was used instead of `git fetch`, because fetch would mutate remote-tracking refs. The live advertisement was:

```text
ref: refs/heads/claude/favorite-song-app-research-vs3yqa  HEAD
4d108931e4e7b33d254cc2c21bd4e5d514b7b827  HEAD
4d108931e4e7b33d254cc2c21bd4e5d514b7b827  refs/heads/claude/favorite-song-app-research-vs3yqa
af2ce1da7e0f05fcc5a0f47f44adfd84b1e2bcdb  refs/heads/main
```

No live remote tag or additional branch was advertised. Remote-side reflogs, deleted refs, and unreachable objects are not exposed by the Git transport protocol and therefore cannot be audited from this clone.

## 5. Exact reachable commit and intent inventory

The graph is one root and one linear descendant chain. `origin/main` is an ancestor of HEAD, and their merge base is `af2ce1da...`. There is no reachable merge commit.

| # | Commit | Parent | Recorded intent | Release disposition |
|---:|---|---|---|---|
| 1 | `af2ce1da7e0f05fcc5a0f47f44adfd84b1e2bcdb` | — | Initialize repository; empty tree | Preserve as topology root; no product artifact |
| 2 | `0069722b41416b7b4087236598d63317ca59b8db` | `af2ce1da...` | SingSong karaoke-session-planner product specification v1.0 | Product problem and planner framing retained; individual v1.0 contracts require later precedence checks |
| 3 | `676cfb250f25f7f6d0d0325ced9cc3ed92bf0faa` | `0069722b...` | Correct cheapest bundle formula, web-payment abuse handling, SQLite-compatible tags | Cheapest-bundle intent retained and reimplemented with current integer/range rules; payment and tags are out of P0 |
| 4 | `168399a9f35c5a63beb21e1777e4c5eeba6f6003` | `676cfb25...` | Change identity from strictly no-login to anonymous-first with delayed passwordless email registration | Anonymous P0 retained; delayed account upgrade is future scope and no auth code ships now |
| 5 | `d63bc66e80e86bb9de3a3a709090de28e5da065d` | `168399a9...` | Add link/image playlist sharing and recipient fork; distinguish fork from live collaboration | Immutable unlisted snapshot and explicit recipient import retained; old multi-list fork semantics adapted to one-active-plan replacement/undo |
| 6 | `385e816f6f7f2d93163121219b3b8b068d19dfea` | `d63bc66e...` | Add Discover and celebrity/curated playlists with publicity-right cautions | Discover excluded from current route set; legal caution retained in catalog/takedown operations |
| 7 | `db1e733a34ae356ce5a4901b3705435e342aafba` | `385e816f...` | Fix celebrity sourcing as fan crowdsourcing with source badges, moderation, and takedown | Feature excluded from P0; provenance, moderation, and takedown requirements retained for any future ingestion |
| 8 | `47f957ca05a3689c3f7029a89235826e137eeb75` | `db1e733a...` | IA rule: session planner is primary; Discover is secondary | Primary planner rule retained; Discover navigation removed from P0 |
| 9 | `070ee59e94d9c8dface2867ba8460e7dfaa011d7` | `47f957ca...` | Keep “SingSong” temporarily and reconsider before launch | Name used for the local candidate; final brand approval remains external/unresolved |
| 10 | `867cfd58838406dadd62e2452192a0af287aa769` | `070ee59e...` | Add Phase-A build plan and milestone prompts | Goal retained, but old stack, data model, routes, and direct-client backend contracts are superseded by v3.2 |
| 11 | `a7522d2ee85ba3bf3fb5b5a7899f9314a6b1fe12` | `867cfd58...` | Add a one-shot master implementation prompt | One-shot execution discipline retained; the old prompt is superseded by current v3.2 documents |
| 12 | `4d108931e4e7b33d254cc2c21bd4e5d514b7b827` | `a7522d2e...` | Require design-quality bar and executed Vitest/Playwright/screenshot evidence | Retained and strengthened by current release gates |
| 13 | `fff4d598aebc9b501874314d6a4a1c0cd1115c9a` | `4d108931...` | Split product intent into 14 detailed design, engineering, verification, and prompt documents; redefine canonical boundaries | Preserve as latest committed intent, but current working-tree v3.2 decisions have higher precedence |

The root commit carries a timestamp approximately three minutes later than its child `0069722...`. This is a clock/order anomaly only; parent topology and object integrity are valid.

No commit in this chain deletes, renames, or copies a file. Changes are additions and modifications to `docs/` only.

## 6. Branches, merges, tags, stash, worktrees, and reflog

| Item | Result |
|---|---|
| Local branches | one feature branch |
| Remote-tracking branches | feature and `main`, plus symbolic `origin/HEAD` |
| Reachable merge commits | 0 |
| Tags, local or advertised remote | 0 |
| Current stash list | empty |
| `refs/stash` | absent |
| Worktrees | one: `C:/Users/agape/Desktop/코딩/singsong` |
| Git notes | none |
| Replace refs / grafts | none / none |
| Pseudo refs (`MERGE_HEAD`, `ORIG_HEAD`, etc.) | none |

The complete available reflog contains five ref entries representing two events:

- 2026-07-21T16:44:55+09:00: clone established HEAD, the local feature branch, and `origin/HEAD` at `4d108931...`.
- 2026-07-21T17:53:18+09:00: local commit advanced HEAD and the local feature branch to `fff4d598...`.

There is no reflog entry for a current stash. The stash-shaped unreachable commits in the next section are recoverable only by object ID while they remain unpruned.

## 7. Unreachable-object audit

### 7.1 Counts and grouping

`git fsck --full --no-reflogs --unreachable --no-progress` returned exactly:

| Object type | Count |
|---|---:|
| commit | 4 |
| tree | 44 |
| blob | 13 |
| **Total** | **61** |

With reflogs considered, the unreachable graph reduces to 13 dangling tips: two WIP commits and eleven root trees. The other two commits and 33 trees are referenced by those unreachable tips.

### 7.2 Four unreachable commits

| Commit | Parents | Tree | Interpretation and disposition |
|---|---|---|---|
| `73ed8f0acb2ae590276e18849218d6628dfe9b33` | `fff4d598...`, `86f7592c...` | `3a745dca63fc953f933a5c15aa37cfbc24f29bb2` | WIP stash form, 2026-07-21 22:18 +09; identical tracked dirty snapshot, no unique requirement |
| `86f7592c104e7d034a6824fb2ebcbcf49700382d` | `fff4d598...` | `5f28b46798674b49e7bb2c6d0c05d7fb23523754` | stash index commit; tree equals HEAD |
| `d762d04f1c657ef95b563bdef20161d92308a4eb` | `fff4d598...`, `c26dfda3...` | `3a745dca63fc953f933a5c15aa37cfbc24f29bb2` | duplicate WIP stash form, 2026-07-21 23:27 +09; no unique requirement |
| `c26dfda385833a76c7ecb5101a83f0748d2eece7` | `fff4d598...` | `5f28b46798674b49e7bb2c6d0c05d7fb23523754` | duplicate stash index commit; tree equals HEAD |

The WIP tree contains the same 16 modified tracked documents as the initial worktree. A direct tree-to-worktree comparison produced no content difference. Default stash behavior did not include the 46 untracked files; Codex tree `50173b...` provides that complete preservation evidence.

### 7.3 Eleven dangling root trees

The file counts and byte totals below are blob payload totals. Object modification time was used only to order the snapshots and is not authoritative commit metadata.

| Root tree | Files | Blob bytes | Meaning |
|---|---:|---:|---|
| `f4d19c63b9d226eec8b16a13c422d5bca19ff7ae` | 24 | 3,446,931 | early final-design documentation plus initial direction assets |
| `b2938da2fb5619c85d15c016a1139cdd31a277c3` | 28 | 9,857,599 | four design-upgrade raster boards; A/C/D are otherwise unreachable |
| `4f6f10003db3bf7ed9b3f460c3c48c969a37c15a` | 26 | 7,163,475 | early direction-asset snapshot |
| `6f3492305e178faec03f62428ae4b1bb853280bb` | 32 | 7,688,314 | first `concepts-10` draft and earlier preview renderings |
| `0cb584612e8cfbbcb5f9b2bde115cd7ce69d11ac` | 33 | 7,689,076 | adopted `concepts-10` document set before ticket studies |
| `c7ae03050d91dbeea35471426ac94d65978506a5` | 53 | 9,079,662 | old ticket-study HTML and incomplete direction set |
| `f5dd1285ae899fda49e749e38477235c9641bdf3` | 57 | 14,629,073 | old ticket-study wording and partial generated directions |
| `55322d69799c560046f0cd8df23660b9812b39a0` | 58 | 19,418,577 | later partial generated-direction snapshot |
| `1664739d0e724054b82c549dc89c87f13f741516` | 61 | 34,877,303 | all direction PNGs with pre-deprecation ticket-study text |
| `a9b5670e49f1156d58364e375ec69fb54a769087` | 62 | 39,669,260 | complete pre-cleanup asset aliases with old ticket-study text |
| `6b41052dd28b729622fec6089c833019e601c166` | 61 | 38,356,227 | final cleaned working tree immediately before v3.2 handoff prompt |

These roots are progressive or parallel snapshots of the same design-document session. They contain no hidden production application code.

### 7.4 All 44 unreachable tree IDs

The eleven root IDs are listed in the preceding table. The remaining 33 referenced tree IDs, including the WIP stash tree, are:

```text
0ebc7fa29dbc075ee7bb18c5153c57111f8ae6a0
11001f333f8e26d422f3a1b3ab616a1a47b8ebae
1d5e145f005d1a5131f56d699d9b91c1fd96e2b9
1e8029015bc36f8285bf5560658f79edb8a6f565
2f32c855c111761c1210bc8a736900f44f4893c2
391a0166e12bcfad46bff0e1ca8a79f1e93d5ff3
3a745dca63fc953f933a5c15aa37cfbc24f29bb2
59d678dee356fe69a367fda0328d88b0b5ca9ee9
5de825c3dd536dc91d1fd2a616409c1e636237a9
67ecab08928c15f0e6e6d3c28008805866edf961
6594b62fa81c94c7f852fa7ed282db44b2d98e6d
706ea2c8a986dd6ae5d624689e0c0cf0b1c16611
72dae02011f1f945380dbba212512537e304e9e9
80f690be01a0ef7f96796757548fc31908e3ef71
83d4fccf6f18a15e39cc241d6fb6ad1a311e17a0
c46c141d526578594a70f0834b3d4fe72be4d7a9
e1f2ea727ea858f7306baed2ed85b3e8517b7b81
ecdcb27745f9609ffe1f9d30d710c41eef1a1cd0
f2762a657f9651242a19b791eb55dc2f17bf7fbc
06f3fae9fe3426da92831adc72a0e644a1d80007
3861093a11e75f3765d8679b016416920a6161d1
40b1a9eaf42d6f6487b1c79c313ac0d989c87aae
4d2da5776ddfebaba766c63c32cc0397070e2f4a
4e2994b166f51cbc67bbe8b0f09bee63bcc4d975
5aa14b239c4652d3cf45e94be69280c16fc9b10d
687f8a68b0062c47770dee375b07856f365fd6ee
78236eef9bd94ccb5be5fb11a3d53fe702f45784
979dce8294b45395bc98cebb074e3f643d9fe4e4
a2cf6faccd805ddd5fb58b4a91a8fa0b14a86fa8
abf31703f0b335da7e2b87952e09363b8c49de19
be538b0551554cbfaa184dd6066830527de7b2ec
cbfda8524175e642a2510f06d7a5a230c1bf5724
e15551e3a57e0c6e44af3abc3958f6f1087571bc
```

Together with the eleven root-tree IDs, this is the complete 44-tree set reported by `fsck`.

### 7.5 All 13 unreachable blobs

| Blob | Historical path/content | Disposition |
|---|---|---|
| `3b9afabea58d88f19863c7e00f741fa16ddacf24` | early `docs/design/concepts-10/index.html` | Superseded by adopted CUTLINE board; no unique contract |
| `486056f90a254bf181087771f08f8bda46f97da6` | early `concepts-10/styles.css` | Superseded; class label changed from recommended to adopted |
| `0db703cc7be4fc19c2c085d278aa4d5770208086` | early `concepts-10/preview.png` | Superseded rendering |
| `41f5091ed6196ff2ba858610462abe0534477392` | early `concepts-10/recommended-cutline.png` | Superseded rendering of the same CUTLINE direction |
| `9c59b6158f927343dbdcbc0644736994017ce05a` | early `concepts-10/README.md` | Later document upgrades CUTLINE from recommendation to explicit adoption |
| `f4486473326bd0119e48456d1b188c0a82353f4a` | old ticket-study `PRINCIPLES_CHECKLIST.md` | Explicitly repudiated by current file as erroneous reference-only evidence |
| `3cf73823aa0c29f086f771aa0c5be0c6973e5d39` | old ticket-study `README.md` | Earlier LEDGER-08 recommendation; current file says non-canonical and do not implement |
| `ec1e69ed756227353115633ca20d3a2ee8932afd` | old ticket-study `index.html` | Current archive adds `noindex`, reference banner, and implementation prohibition |
| `98a3882375be740597d7054e57a2d92a5ae183c8` | old ticket-study `styles.css` | Superseded by reference-only banner styling |
| `ad01c51eae20b9ccfc69e61a88df9296d616222d` | old `ticket-directions/README.md` | Superseded before directions 03–06 were generated and scored |
| `7332ea854cd9f557fa257df81efbc39e33513fbe` | `docs/design/upgrades/proposal-a-press-ledger.png`, 1536×1024 | Reference-only sequential-state evidence; do not ship raster |
| `bd402cb7bbb97cf5eab76bd9721612fa66bede83` | `docs/design/upgrades/proposal-c-civic-session-registry.png`, 1536×1024 | Reference-only sequential-state evidence; do not ship raster |
| `e4dce5833666969f8d794dda4b8e0cf20f71afef` | `docs/design/upgrades/proposal-d-session-route-pass.png`, 1672×941 | Reference-only sequential-state evidence; do not ship raster |

The three otherwise-lost upgrade images are rooted at tree `b2938da2fb5619c85d15c016a1139cdd31a277c3`. They were decoded directly from loose Git objects in memory, without writing recovered files. Each shows four sequential mobile states—Search, Plan, Issued, Received—and labels itself `REFERENCE ONLY — DESIGN UPGRADE — SEQUENTIAL STATES, NOT TABS`. That sequential-state principle is retained; the raster style is excluded.

Proposal B, `proposal-b-after-hours-booth.png`, is not lost: its blob `5dc3a18518865318a90ce3feb77224fe100d2258` is reachable through the current `docs/design/assets/생성된 이미지 2.png` path.

## 8. Preservation evidence

The initial state is recoverable from multiple independent observations:

1. Porcelain v2 recorded 16 worktree modifications, 46 untracked files, no index change, and the exact branch/upstream relationship.
2. `git diff HEAD 50173b...` reports exactly 16 modified and 46 added paths.
3. Every path in tree `50173b...` was hashed from the filesystem with Git filters applied. Result: `matched=62 missing=0 mismatch=0`.
4. Tree `3a745d...` matches the 16 tracked working-file contents and is referenced by both unreachable WIP commits.
5. Both stash-index commits point to HEAD tree `5f28b467...`, confirming the index was clean.
6. `git diff --cached` and `git ls-files -u` were empty.
7. No destructive or history-mutating command was executed during the audit.

The Codex refs are tool-owned and may not be a permanent archival interface. This document records their full IDs so later cleanup does not erase the evidence silently. Unreachable objects are also GC-prunable; their product disposition is captured above so no requirement depends on preserving the binary objects indefinitely.

## 9. Submodule audit and command limitation

`git submodule status --recursive` could not run in this Windows sandbox because Git's shell helper could not locate `basename`, `sed`, or `git-sh-setup`:

```text
git-submodule: basename: command not found
git-submodule: sed: command not found
git-submodule: .: git-sh-setup: file not found
```

This tool failure was closed with direct object inspection:

- no `.gitmodules` path appears in HEAD, any reachable commit, either Codex tree, or any dangling root tree;
- no tree entry with mode `160000` appears in any of those objects;
- no nested worktree or linked Git directory was found.

Verdict: there is no submodule. The failed wrapper command does not leave an unresolved inventory gap.

## 10. Git LFS audit

| Check | Result |
|---|---|
| Git LFS executable | `git-lfs/3.7.1` available |
| Global LFS filters | configured |
| Repository `.gitattributes` | absent in all reachable history |
| `git lfs ls-files --all --long` | empty |
| Repository `.git/lfs` directory | absent |
| Local LFS configuration | none |
| Promisor files | none |

All PNGs are ordinary Git blobs. No `git lfs fetch` was run because there is no tracked LFS object and such a fetch would write downloaded data.

## 11. Object-store integrity and repository shape

| Metric/check | Result |
|---|---|
| Git version | 2.52.0.windows.1 |
| Total objects | 208: 102 blobs, 17 commits, 89 trees |
| Packed objects | 47 |
| Loose objects | 161 |
| Pack size | 43.06 KiB reported; pack file verified `ok` |
| Loose-object size | 36.09 MiB reported |
| Garbage objects/files | 0 / 0 bytes |
| `git fsck --full --strict` | exit 0; only dangling tips listed |
| Repository format | 0 |
| Shallow file | absent |
| Partial/promisor clone | no extension, promisor setting, or `.promisor` pack |
| Alternate object store | none |
| Sparse checkout | no config and no sparse-checkout file |
| Custom `.git/hooks` | none; sample files only |
| Worktree count | 1 |

The 17 commits are the 13 reachable history commits plus the four unreachable stash-shaped commits. The 147 objects reachable from refs plus the 61 unreachable objects account for all 208 objects.

## 12. Security and privacy inspection

All reachable commits, the two Codex trees, the eleven dangling root trees, and the two WIP commit tips were searched without emitting matching secret values.

Strong signatures checked included private-key headers, AWS access keys, GitHub tokens, Slack tokens, OpenAI-style keys, Google API keys, and three-part JWTs. Sensitive path checks included `.env*`, `*.pem`, `*.p12`, `*.pfx`, `*.key`, and secret/credential/private-key filenames.

Results:

- strong credential signature paths: none;
- sensitive credential filenames: none;
- credential embedded in remote URL: none;
- Git config values that could expose credentials were not printed; only config names and sanitized remote information were recorded;
- commit objects expose two different author email identities. Those addresses are personal metadata, are not repeated here, and should be considered before keeping the repository public.

This is a targeted repository-history scan, not proof that an external service has never received a secret.

## 13. Historical requirement disposition matrix

Precedence follows `RELEASE_BUILD_PLAN.md`: current user request → preservation/security/legal constraints → current canonical documents → latest Git intent → older evidence. Every distinct requirement family found in the 13 commits and their historical document versions is assigned a release disposition below.

| ID | Historical requirement or decision | Evidence | Current disposition | Reason/current owner |
|---|---|---|---|---|
| GH-01 | SingSong is a karaoke-outing/session planner, not a streaming player | v1.0 spec | **IMPLEMENT** | Core current product value |
| GH-02 | PWA first, native Android/iOS later | v1.0 spec, old build plan | **IMPLEMENT PWA; DEFER native** | Current release target is installable web; physical/native validation is external follow-up |
| GH-03 | Home/first entry centers the session planner | `47f957c...` | **IMPLEMENT** | Retained as one active CUTLINE Session Strip |
| GH-04 | Discover is a secondary tab | `385e816...`, `47f957c...` | **EXCLUDE P0** | Current route set intentionally has no Discover navigation |
| GH-05 | Search by title, artist, TJ/KY number, and Korean initial consonants | v1.0 and build plan | **IMPLEMENT LOCALLY WITH FIXTURE; BLOCK production catalog** | Search behavior is testable, but catalog rights/accuracy require external approval |
| GH-06 | Use real or example TJ/KY song numbers as seed data | old build/test plans | **REPLACE with visibly fake deterministic fixtures** | Prevent false catalog claims; production ingestion remains blocked |
| GH-07 | Multiple playlists/lists CRUD | v1.0/build plan | **SUPERSEDED** | v3.2 owns one active plan with revisions, replacement import, and undo |
| GH-08 | Per-song key, memo, tags, and last-sung history | v1.0/build plan | **EXCLUDE P0** | Not part of current minimum one-plan contract; avoids reviving legacy local model |
| GH-09 | Store tags as JSON/CSV rather than a PostgreSQL array | `676cfb2...` | **NOT APPLICABLE P0** | Tag feature is excluded; retain compatibility note only if tags return later |
| GH-10 | Local-first personal data in IndexedDB | v1.0/build plan | **IMPLEMENT** | Dexie one-active-plan repository; no personal plan upload |
| GH-11 | Strictly no login, optionally recovery code/QR | v1.0–v1.1 | **SUPERSEDED** | Later identity decision replaces recovery-code-only strategy |
| GH-12 | Anonymous first, delayed passwordless email for payment/cloud sync | `168399a...` | **DEFER; NO AUTH P0** | P0 must remain usable without account; account/sync are future scope |
| GH-13 | Platform IAP or web subscription/license key | early payment text | **EXCLUDE P0** | Payment, entitlement, and device activation are outside authorized release scope |
| GH-14 | Personal cloud sync, backup, and anonymous-to-account migration | identity decision | **DEFER** | Requires auth, privacy, deletion, and operations work not in current candidate |
| GH-15 | Calculator supports coin-per-song, coin-per-time, and room-per-time | v1.0/build plan | **IMPLEMENT** | Current domain owns deterministic forward/reverse calculations |
| GH-16 | Bundle cost uses the cheaper of remainder singles and one more bundle | `676cfb2...` | **IMPLEMENT, strengthened** | Enumerate cheapest integer-won solution and property-test it |
| GH-17 | Display a single estimated duration/cost derived from average minutes | old calculator | **SUPERSEDED** | Current truth contract uses integer seconds/won and honest ranges; display rounding is separate from billing |
| GH-18 | Reverse calculation by budget/time | v1.0/build plan | **IMPLEMENT** | Must call or verify against the same forward function, not a divergent formula |
| GH-19 | Ticket is the visual and sharing hero | v1.0/build/design history | **IMPLEMENT semantically** | CUTLINE ticket is issued from a plan revision and exports deterministically |
| GH-20 | Ticket PNG export | build plan | **IMPLEMENT** | Canonical light 1080×1350 export with real download verification |
| GH-21 | Public/read-only share link stored directly from the client in Supabase | old build/API contract | **SECURITY-SUPERSEDED** | Current share is unlisted, immutable, server-owned BFF; direct table access/grants are forbidden |
| GH-22 | Recipient forks a shared list into an independent local list | `d63bc66...` | **ADAPT AND IMPLEMENT** | Explicit import/handoff replaces the one active plan with confirmation, revision safety, and undo |
| GH-23 | Live room/group collaborative queue | v1.0 sharing distinction | **EXCLUDE P0** | Fork/import remains asynchronous; no realtime collaboration |
| GH-24 | Kakao JS SDK sharing and Kakao OG verification | old build plan | **OPTIONAL/BLOCKED_EXTERNAL** | Local Web Share/copy path can ship; Kakao credential/domain/device proof cannot be fabricated |
| GH-25 | Share/image contains generated decorative barcode or QR | old raster concepts | **REJECT raster artifact** | Any real code must derive from a public URL and be machine generated; decorative codes do not ship |
| GH-26 | Discover celebrity/editor/fan playlists | `385e816...` | **EXCLUDE P0** | Not in current product route or data model |
| GH-27 | Fan-submitted celebrity sources, badges, voting/moderation | `db1e733...` | **DEFER feature; RETAIN governance** | Future ingestion requires provenance, moderation, and trust policy |
| GH-28 | No celebrity photo without rights; label unofficial content; takedown promptly | `385e816...`, `db1e733...` | **RETAIN as release/legal gate** | Applies to any future catalog/editorial ingestion |
| GH-29 | Streaming playlist import from Melon/YouTube Music | old roadmap/build exclusions | **EXCLUDE** | Current `/import` means recipient share-snapshot handoff, not streaming-service scraping |
| GH-30 | Album artwork via iTunes URL | old spec/build plan | **EXCLUDE P0** | Current product deliberately has no album-art dependency or third-party media hosting |
| GH-31 | No lyrics or audio hosting | v1.0 legal constraints | **RETAIN** | Avoid licensing and media-hosting surface |
| GH-32 | Next.js 15, Node 20+, historical dependency list | `867cfd5...` | **SUPERSEDED by current exact stack line** | Current documents require Node 24.18, pnpm 11.9, Next 16.1, React 19.2 and current approved libraries |
| GH-33 | Routes `/list/[id]` and `/discover`; list/history navigation | old build plan | **REJECT** | Current routes are `/`, `/search`, `/ticket`, `/s/[slug]`, `/import`, `/offline` |
| GH-34 | Direct anonymous Supabase `songs`/`shared_lists` policies and public insert/select | old API/security docs | **SECURITY-SUPERSEDED** | Function-only storage boundary, server validation, TTL, revoke, rate limit, and Turnstile gates |
| GH-35 | Zustand/TanStack state architecture | old build/architecture docs | **DO NOT REVIVE BY DEFAULT** | State ownership follows current domain/data/features/app boundaries; dependencies need current justification |
| GH-36 | PWA app-shell and last local plan remain available offline | old and current plans | **IMPLEMENT** | Serwist/static/local cache only; API/share/OG/search/mutations must never be cached |
| GH-37 | Silent service-worker updates | implicit old PWA | **SUPERSEDED** | Waiting update requires explicit user approval |
| GH-38 | Old palette `#FDF6F9/#FF2E74/#F5A623/#1C1622` and ticket-card component style | committed build plan | **SUPERSEDED** | Current CUTLINE/Session Strip semantic tokens and design direction have priority |
| GH-39 | CUTLINE is the adopted base direction; do not mix nine alternatives before validation | current design snapshots, historical evolution | **IMPLEMENT** | `ADOPTION.md` is explicit and newer than the committed generic design bar |
| GH-40 | Ticket-concepts LEDGER 08 is recommended | old unreachable ticket-study blobs | **REJECT** | Current files explicitly mark the study erroneous, non-canonical, and do-not-implement |
| GH-41 | Generated ticket-direction PNGs are product assets | design exploration history | **REJECT** | All are internal reference-only rasters; implement semantic HTML/CSS/human-reviewed SVG |
| GH-42 | Search→Plan→Issued→Received is four tab navigation | upgrade-board visual risk | **REJECT tabs; RETAIN sequential states** | All four recovered boards state “SEQUENTIAL STATES, NOT TABS” |
| GH-43 | Framer Motion microinteractions and ticket issue animation | old build plan | **IMPLEMENT narrowly with current `motion/react`** | One-time issue motion and useful transitions only; reduced-motion and interruption safety mandatory |
| GH-44 | Light and dark modes, keyboard focus, semantic markup, reduced motion | `4d10893...` and detailed docs | **IMPLEMENT and verify** | Expanded to forced colors, zoom/text resize, IME, Playwright and axe gates |
| GH-45 | Vitest calculator/chosung/share tests | old verification plan | **IMPLEMENT intent; replace obsolete vectors** | Current unit/property/schema suite must use v3 domain contracts |
| GH-46 | Playwright core flow, screenshots, and executed evidence | `4d10893...` | **IMPLEMENT and strengthen** | No narrative-only pass; store machine-readable evidence under the run ID |
| GH-47 | Local Supabase contract tests or SQL fallback | old test plan | **ADAPT** | Static privilege/migration checks are mandatory; real service checks are `BLOCKED_EXTERNAL` without credentials |
| GH-48 | Vercel deployment and production URL as completion proof | old build plan | **PREPARE, DO NOT CLAIM deployment** | Deliver deployable architecture and runbook; real domain/credentials/legal/ops gates stay external |
| GH-49 | Real catalog crawling or unsourced song DB | old prompts prohibit it | **REJECT** | No scraping or fabricated production catalog; rights and takedown approval are release blockers |
| GH-50 | “SingSong” is the final approved product name | name-history commit | **UNRESOLVED_EXTERNAL** | Use as working name only; owner must approve before public launch |

No historical family remains without one of: implement, adapt, supersede, defer, exclude/reject, or block externally.

## 14. Unavailable or non-authoritative data

- Remote reflogs, deleted remote branches/tags, remote-side stashes, and remote unreachable objects cannot be obtained through `ls-remote`.
- No fetch was performed, so local remote-tracking refs were not mutated. The live advertised refs were checked separately and matched.
- The user-global ignore file was inaccessible under sandbox permissions. Direct filesystem enumeration, performed separately, is the authority for ignored local material.
- The submodule wrapper was broken in the sandbox, but direct `.gitmodules` and gitlink enumeration closed that gap.
- Loose-object filesystem modification times are not Git history timestamps and are used only as supporting order for design snapshots.
- Unreachable objects can be pruned at any time. This report records their IDs, content, and disposition so release correctness does not depend on retaining them.
- The `.remember` project hook may append ignored runtime logs when shell tools run. Those logs are operational metadata, not product or Git-history evidence.

## 15. Reproduction commands

Run these from the repository root. Commands are read-only; do not add `--lost-found`, `-w`, fetch, prune, or GC options.

```powershell
git status --porcelain=v2 --branch --untracked-files=all
git status --short --branch --untracked-files=all
git diff --name-status
git diff --cached --name-status
git diff --stat

git for-each-ref --sort=refname --format='%(refname)%09%(objecttype)%09%(objectname)%09%(*objectname)%09%(upstream:short)%09%(upstream:track)%09%(committerdate:iso-strict)%09%(subject)'
git show-ref --head --dereference
git branch -a -vv --no-abbrev
git tag -n99 --sort=refname
git worktree list --porcelain
git stash list --date=iso
git reflog show --all --date=iso-strict

git log --all --graph --decorate=full --date=iso-strict --pretty=format:'%H%x09%P%x09%T%x09%ad%x09%D%x09%s'
git log --all --reverse --name-status --find-renames --find-copies
git rev-list --all --count
git rev-list --all --min-parents=2
git merge-base origin/main HEAD
git log --all --diff-filter=DRC --summary --find-renames --find-copies

git ls-remote --symref origin HEAD 'refs/heads/*' 'refs/tags/*'

git fsck --full --no-reflogs --unreachable --no-progress
git fsck --full --strict --no-progress
git count-objects -vH
git cat-file --batch-all-objects --batch-check='%(objecttype) %(objectsize)'

$idx = Get-ChildItem -LiteralPath .git\objects\pack -Filter '*.idx' -File | Select-Object -First 1 -ExpandProperty FullName
git verify-pack -v -- $idx

git lfs version
git lfs ls-files --all --long
git ls-files '.gitattributes' '.gitmodules' '**/.gitmodules'

git replace -l
git notes list
git ls-files -u
git rev-parse --is-shallow-repository
```

For submodule verification when `git submodule` is unavailable, enumerate every relevant commit/tree with `git ls-tree -r` and assert that no entry begins with mode `160000`; also assert that no `.gitmodules` path exists.

For preservation verification, compare `HEAD` with tree `50173b6288ba484fc40b9d6d8b16dc40497b8280`, then hash each listed filesystem path with `git hash-object --path=<path> -- <path>` without `-w`. The recorded baseline result is `matched=62 missing=0 mismatch=0`.

## 16. Final preservation statement

At the audit boundary, the original branch topology, all normal refs, all four Codex refs, the clean index, the 16 modified tracked files, and all 46 untracked user files were preserved. No original commit or ref was rewritten. The working material was independently captured by tree `50173b...`, and the tracked dirty subset was also present in duplicate stash-shaped unreachable WIP objects.

The history audit therefore finds no missing implementation to resurrect and no unclassified historical requirement. Current release work must implement the v3.2 plan, retain the validated product intent above, explicitly exclude superseded designs and insecure legacy contracts, and keep all external catalog, credential, legal, domain, operations, and physical-device gates visibly blocked until their owners supply evidence.
