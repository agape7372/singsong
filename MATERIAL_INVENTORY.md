# SingSong pre-change material inventory

Audit snapshot: 2026-07-22, before release implementation  
Workspace: `C:\Users\agape\Desktop\코딩\singsong`  
Scope: every non-`.git` file and directory visible through recursive forced filesystem enumeration, including Git-ignored and untracked material. `.git` object/ref details belong to `GIT_HISTORY_AUDIT.md`; only its presence and aggregate size are recorded here.

## Evidence boundary

- The initial non-`.git` snapshot contained **65 files, 15 directories, and 38,718,584 bytes**.
- Independent counts agreed: recursive `Get-ChildItem -Force`, `rg --files -uu -g '!.git/**'`, and Git classification (`16 tracked + 46 untracked + 3 ignored = 65`).
- All 16 tracked files were already modified. All 46 untracked files and all pre-existing ignored files are treated as user material and preserved.
- No symlink or reparse point was present. Filesystem enumeration completed without a project-tree access error.
- `.git` existed and contained 195 filesystem entries totaling 37,920,282 bytes at the audit snapshot. Its individual metadata files are intentionally absent from this material table.
- Running read-only audit commands triggered the repository's `.remember` hook, which created `.remember/logs/memory-2026-07-22.log`. That file is listed under **Post-baseline material** and is not counted among the initial 65.
- `RELEASE_BUILD_PLAN.md` and the two audit records created after the snapshot are also not counted among the initial 65.

## Disposition vocabulary

Every initial file has exactly one primary disposition.

| Disposition | Meaning |
|---|---|
| `IMPLEMENT_DIRECTLY` | A current canonical contract whose requirements must map to implementation and tests. |
| `ALREADY_SATISFIED` | The material's requirement was already fully implemented at the initial snapshot. No initial file qualifies because no application existed. |
| `DOC_DESIGN_TEST_OPS` | Retained and used as documentation, design evidence, test input, audit evidence, or operational context; not shipped verbatim as application code/assets. |
| `DUPLICATE_OR_SUPERSEDED` | Retained as history/reference, but a newer canonical contract wins or the artifact is explicitly noncanonical/reference-only. |
| `EXCLUDED_SECURITY_TECH_PRODUCT` | Retained but excluded from product, bundle, commit, or release evidence for a concrete security, technical, or product reason. |
| `BLOCKED_EXTERNAL` | Cannot be incorporated or verified without external access/authority. This applies to external limitations, not to any of the initial 65 local files. |

Initial-file disposition totals: `IMPLEMENT_DIRECTLY=5`, `ALREADY_SATISFIED=0`, `DOC_DESIGN_TEST_OPS=13`, `DUPLICATE_OR_SUPERSEDED=44`, `EXCLUDED_SECURITY_TECH_PRODUCT=3`, total **65**.

## Initial Markdown files — 29

Hashes and detailed read/conflict status are in `MD_READ_LEDGER.md`.

| ID | Path | Bytes | Use | Canonicality | Disposition |
|---|---|---:|---|---|---|
| F-001 | `APP_FINAL_DESIGN_PLAN.md` | 4,126 | Completed review-plan record and deliverable map | Historical process record; not product contract | `DOC_DESIGN_TEST_OPS` |
| F-002 | `docs/BUILD_PLAN.md` | 26,158 | Old M0–M6 build plan, formula and prompt history | Explicit v3 legacy warning | `DUPLICATE_OR_SUPERSEDED` |
| F-003 | `docs/CODEX_FINAL_REVIEW.md` | 21,653 | Independent critique and rationale for v3 corrections | Decision rationale subordinate to blueprint | `DOC_DESIGN_TEST_OPS` |
| F-004 | `docs/FINAL_BLUEPRINT.md` | 62,708 | Product, UX, calculation, architecture, safety and release contract | Highest in-repository product canonical v3.2 | `IMPLEMENT_DIRECTLY` |
| F-005 | `docs/PRODUCT_SPEC.md` | 32,695 | Market, persona and long-term roadmap history | Explicit legacy warning for P0 conflicts | `DUPLICATE_OR_SUPERSEDED` |
| F-006 | `docs/README.md` | 7,639 | Source-of-truth order and conflict map | Canonical document index | `DOC_DESIGN_TEST_OPS` |
| F-007 | `docs/UNKNOWN_REGISTER.md` | 52,589 | 19 open product unknowns and 5 implementation contracts awaiting evidence | Canonical unknown/evidence register | `DOC_DESIGN_TEST_OPS` |
| F-008 | `docs/design/COMPONENTS.md` | 41,870 | Old 16-component state/prop reference | Prebuild-all contract explicitly retired | `DUPLICATE_OR_SUPERSEDED` |
| F-009 | `docs/design/DESIGN_SYSTEM.md` | 23,584 | Old token and contrast evidence | Superseded where visual v3 differs | `DUPLICATE_OR_SUPERSEDED` |
| F-010 | `docs/design/MICROCOPY.md` | 21,597 | Korean tone and formatting examples | Legacy wording; v3 truthfulness/public-scope semantics win | `DUPLICATE_OR_SUPERSEDED` |
| F-011 | `docs/design/SCREENS.md` | 36,095 | Old six-screen matrices and interaction history | Dynamic list/ticket routes and indexable share retired | `DUPLICATE_OR_SUPERSEDED` |
| F-012 | `docs/design/UX_FLOWS.md` | 33,426 | Journey, recovery and platform-edge history | Multi-list/public/fork assumptions superseded | `DUPLICATE_OR_SUPERSEDED` |
| F-013 | `docs/design/VISUAL_MOTION_DIRECTION.md` | 45,498 | Session Strip/CUTLINE visual, motion, responsive, a11y, PNG/OG contract | Current visual and motion canonical | `IMPLEMENT_DIRECTLY` |
| F-014 | `docs/design/assets/README.md` | 1,547 | Generated-reference inventory, hashes and copy restrictions | Asset-governance evidence; one referenced alias absent | `DOC_DESIGN_TEST_OPS` |
| F-015 | `docs/design/concepts-10/ADOPTION.md` | 2,400 | Records CUTLINE adoption and locked visual constraints | Adopted decision subordinate to v3 visual canonical | `IMPLEMENT_DIRECTLY` |
| F-016 | `docs/design/concepts-10/README.md` | 1,503 | Explains ten-concept comparison and fixture | Comparison-board documentation | `DOC_DESIGN_TEST_OPS` |
| F-017 | `docs/design/ticket-concepts-10/PRINCIPLES_CHECKLIST.md` | 3,772 | Archived ticket self-review and conflict record | Explicit reference-only/noncanonical | `DUPLICATE_OR_SUPERSEDED` |
| F-018 | `docs/design/ticket-concepts-10/README.md` | 2,510 | Describes ten archived ticket exports | Explicit reference-only/do-not-implement | `DUPLICATE_OR_SUPERSEDED` |
| F-019 | `docs/design/ticket-directions/README.md` | 4,944 | Six generated ticket explorations and scoring | Exploration; visual canonical wins | `DUPLICATE_OR_SUPERSEDED` |
| F-020 | `docs/design/ticket-directions/TICKET_PROMPT_PRINCIPLES.md` | 119,765 | Ticket-commission and image-prompt research | Explicit draft/exploration, not canonical | `DUPLICATE_OR_SUPERSEDED` |
| F-021 | `docs/engineering/ANALYTICS.md` | 17,547 | Old event and metric design history | Fixed events/viewer/fork/retention formulas retired | `DUPLICATE_OR_SUPERSEDED` |
| F-022 | `docs/engineering/API_CONTRACT.md` | 14,674 | Old DDL/RPC/RLS/payload history | Direct anon/public table contract explicitly forbidden | `DUPLICATE_OR_SUPERSEDED` |
| F-023 | `docs/engineering/ARCHITECTURE.md` | 27,287 | Old state ownership, Dexie and cache ideas | Multi-list/history/default state libraries superseded | `DUPLICATE_OR_SUPERSEDED` |
| F-024 | `docs/engineering/PLATFORM_NOTES.md` | 31,888 | IME, Safari, Kakao and PWA edge evidence | Edge evidence retained; conflicting IME/storage behavior superseded | `DUPLICATE_OR_SUPERSEDED` |
| F-025 | `docs/engineering/SECURITY.md` | 25,249 | Threat, CSP, env and takedown history | Threat ideas retained; public/legacy-key model superseded | `DUPLICATE_OR_SUPERSEDED` |
| F-026 | `docs/prompts/ONESHOT_IMPLEMENTATION_HANDOFF_V3_2.md` | 64,627 | Latest implementation handoff, stack, stages and external gates | Current execution contract; does not override blueprint | `IMPLEMENT_DIRECTLY` |
| F-027 | `docs/prompts/ONESHOT_MASTER.md` | 65,918 | Resumable vertical-slice implementation and evidence protocol | Current one-shot execution canonical v3.2 | `IMPLEMENT_DIRECTLY` |
| F-028 | `docs/verification/QA_MATRIX.md` | 23,976 | Old category/screen quality matrix and external-prompt mapping | Scenario evidence only; v3 gate model wins | `DUPLICATE_OR_SUPERSEDED` |
| F-029 | `docs/verification/TEST_PLAN.md` | 22,404 | Old unit/contract/E2E/a11y/performance scenarios | Old vectors/mock pass rules retired | `DUPLICATE_OR_SUPERSEDED` |

## Initial static mock source — 6

These were the only executable-looking source files at the snapshot. They are standalone comparison boards, not the SingSong application.

| ID | Path | Bytes | SHA-256 | Use and inspection | Canonicality | Disposition |
|---|---|---:|---|---|---|---|
| F-030 | `docs/design/concepts-10/app.js` | 3,583 | `76358FC3246F5C5A2ABA02A478C2A9CB9A83C1C71094AA3C18939D90E76B0DE1` | Filter, dialog preview, toast and data-attribute self-test; `node --check` passed | Comparison-board behavior only | `DOC_DESIGN_TEST_OPS` |
| F-031 | `docs/design/concepts-10/index.html` | 29,759 | `65879C778E75D9695D15F57D3FE80162AE417B6E6DB9204B46C94C7649E1C210` | Ten mobile visual concepts with fixed fixture; no API/router/database | CUTLINE evidence, not product route | `DOC_DESIGN_TEST_OPS` |
| F-032 | `docs/design/concepts-10/styles.css` | 39,485 | `5FDC253083849E682C37113A898DD4DB28F90011C3DC9BC6E123BC5E8F9933B0` | Responsive comparison grid, focus/reduced-motion/print and ten theme mocks | Visual comparison evidence | `DOC_DESIGN_TEST_OPS` |
| F-033 | `docs/design/ticket-concepts-10/app.js` | 5,834 | `83C84A28424CFDE6AF6E04781C719BBEABB477E73FCF003CD2EE5585D3D060E8` | Deterministic mock barcode/export/filter/self-test; `node --check` passed | Explicitly archived/noncanonical | `DUPLICATE_OR_SUPERSEDED` |
| F-034 | `docs/design/ticket-concepts-10/index.html` | 24,044 | `5AF6DF01DB7FC205212930DC5EFFAE55842D8A85B0FD4DA986BDC02FCC7676B2` | Ten static ticket layouts; robots noindex and DO NOT IMPLEMENT | Explicitly archived/noncanonical | `DUPLICATE_OR_SUPERSEDED` |
| F-035 | `docs/design/ticket-concepts-10/styles.css` | 26,085 | `E4E318E72AAAFE1B1755B65E195518BF7857A814C3F322848A5173FA97F4A083` | 540×675 mock renderer and responsive/print styles | Explicitly archived/noncanonical | `DUPLICATE_OR_SUPERSEDED` |

## Initial PNG assets — 27

All 27 PNGs decoded successfully. Dimensions, byte size and SHA-256 were measured without editing. No EXIF-like personal metadata was found; the three image properties exposed by the decoder were frame/dimension properties. Generated images are never production UI, logos or icons; where retained, they are design-review evidence only.

| ID | Path | Bytes | Dimensions | SHA-256 | Use / canonicality | Disposition |
|---|---|---:|---:|---|---|---|
| F-036 | `docs/design/assets/ticket-issue-storyboard.png` | 1,327,036 | 1672×941 | `2CAB5AEE6D1880619CA83D0DDFE7B7251233FC5D6FAD40BF2B1B3B23C3FAA71D` | Viewed; issue-rise and reduced-motion storyboard, reference-only | `DOC_DESIGN_TEST_OPS` |
| F-037 | `docs/design/assets/보관.png` | 4,789,504 | 2752×1536 | `99AAF9F00876FBB266A1E5059B04CF6930896C43F4C961E929EDA8E05A151978` | Viewed; byte-identical duplicate of F-059 | `DUPLICATE_OR_SUPERSEDED` |
| F-038 | `docs/design/assets/생성된 이미지 2.png` | 1,404,751 | 1672×941 | `365077AD34E291AB160642D220E126A0F0C957E13EB9091E0C7ADFD813CDBD97` | Viewed; dark After-hours/QR legacy direction | `DUPLICATE_OR_SUPERSEDED` |
| F-039 | `docs/design/assets/순서.png` | 1,314,531 | 1672×941 | `2715E84AC73B5C43ECD7462BBF9C521671AAD4893E672F34F8B8C7A8B4C9AE61` | Viewed; obsolete four-tab/public-share flow | `DUPLICATE_OR_SUPERSEDED` |
| F-040 | `docs/design/assets/최종.png` | 1,480,147 | 1672×941 | `1BF6322F4FE5D670FB0B5F0D23F155676C3FA97584B8F5FBC9708DEB314F5290` | Viewed; Session Strip reference; hash matches missing English alias | `DOC_DESIGN_TEST_OPS` |
| F-041 | `docs/design/assets/최종2.png` | 1,515,598 | 1536×1024 | `5EFC96F86A57C85C0CFA8E45B8E0DD5A751B6E7E12415D80063E5A54715AF7FC` | Viewed; earlier Press Ledger/QR sequence | `DUPLICATE_OR_SUPERSEDED` |
| F-042 | `docs/design/concepts-10/preview.png` | 399,906 | 2200×2300 | `D38ABB673F4D54C3697F821872DD4D8442940E693F69CB25F2F6C7C9E8334098` | Viewed; contact sheet for ten concept directions | `DOC_DESIGN_TEST_OPS` |
| F-043 | `docs/design/concepts-10/recommended-cutline.png` | 48,965 | 600×980 | `2813928E50804F78D43E606E253C22E5144E712952202FED6762B9A69141A291` | CUTLINE selected concept reference | `DOC_DESIGN_TEST_OPS` |
| F-044 | `docs/design/ticket-concepts-10/exports/ticket-01.png` | 73,672 | 1080×1350 | `6FB57B42F8A29EE964AFDFCD67A116D61741FEA75685C991F12E7B9DCDAF99FD` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-045 | `docs/design/ticket-concepts-10/exports/ticket-02.png` | 73,865 | 1080×1350 | `EAB35616AC1CE7560A032994B369ABE04EBD0ECB8D62450B51F2A44416B0E629` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-046 | `docs/design/ticket-concepts-10/exports/ticket-03.png` | 76,462 | 1080×1350 | `F5A667CCB2F15A1C07DE6486602BD32F2401623C013A8B1B38A87E77A3C77053` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-047 | `docs/design/ticket-concepts-10/exports/ticket-04.png` | 63,782 | 1080×1350 | `750709921766896775CE54BF410884BE1FABA0691753802F9091F53615C60DE8` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-048 | `docs/design/ticket-concepts-10/exports/ticket-05.png` | 71,986 | 1080×1350 | `356C26CD8E63E067FC0DCE4E0B4F8E304B7FCA7C17A255BD9CAFEE6FDB101144` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-049 | `docs/design/ticket-concepts-10/exports/ticket-06.png` | 65,466 | 1080×1350 | `DB335573F79B6C837BB44CF9563D3D3ACC88E9B60E827A48C074BD5C172999D3` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-050 | `docs/design/ticket-concepts-10/exports/ticket-07.png` | 73,073 | 1080×1350 | `5713FA42BE30A4B488453F363E919DCB31BF6DD350BE83014D50109149FAD24C` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-051 | `docs/design/ticket-concepts-10/exports/ticket-08.png` | 67,444 | 1080×1350 | `4E784BD24A1CE55A0B9170B415EA199B9BBE53D6AF861765AD9E1CB34205AE21` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-052 | `docs/design/ticket-concepts-10/exports/ticket-09.png` | 77,764 | 1080×1350 | `5A670405CAE5CFECBC26E34B8AC6196B71B2BBED454B777D44E129C55D6C3994` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-053 | `docs/design/ticket-concepts-10/exports/ticket-10.png` | 65,028 | 1080×1350 | `E2515169130776BAEC8D97BEA47490A61081863423B600EBBFB54296CC90EED1` | Archived ticket export; verified via contact sheet and metadata | `DUPLICATE_OR_SUPERSEDED` |
| F-054 | `docs/design/ticket-concepts-10/preview.png` | 344,573 | 2200×2250 | `281E1C805C491112A8FDF84ABB873FBD09FCB02BDD8432AB72E478D1432F5770` | Viewed; contact sheet for ten archived layouts | `DUPLICATE_OR_SUPERSEDED` |
| F-055 | `docs/design/ticket-concepts-10/preview-mobile.png` | 96,927 | 500×1600 | `7D022C078901D414FB236F3CBEE3AD3B14DD323F8B581DE8628387DAA064D802` | Archived narrow comparison preview | `DUPLICATE_OR_SUPERSEDED` |
| F-056 | `docs/design/ticket-concepts-10/recommended-ledger-08.png` | 57,541 | 760×900 | `58FB7B02E9C42AFABA393E92E7F27F359EC5EE300BF4CF216419B4336F486606` | Historical Ledger 08 recommendation; later visual canonical wins | `DUPLICATE_OR_SUPERSEDED` |
| F-057 | `docs/design/ticket-directions/01-plum-pop-cover.png` | 1,717,840 | 1672×941 | `CCCD3E203FFD96BF208FE61A0560B632B84C064A8B52FD6A8BDAAD9925E29A5A` | Viewed; generated ticket exploration | `DUPLICATE_OR_SUPERSEDED` |
| F-058 | `docs/design/ticket-directions/02-midnight-zine-flash.png` | 1,998,704 | 1672×941 | `A9F7A9421857D2B1E861374F56A3AA2EB09794C4741D0E1E9B2099C7906EBD8A` | Viewed; generated ticket exploration | `DUPLICATE_OR_SUPERSEDED` |
| F-059 | `docs/design/ticket-directions/03-ot-stub-m.png` | 4,789,504 | 2752×1536 | `99AAF9F00876FBB266A1E5059B04CF6930896C43F4C961E929EDA8E05A151978` | Viewed through byte-identical F-037; generated exploration | `DUPLICATE_OR_SUPERSEDED` |
| F-060 | `docs/design/ticket-directions/04-thermal-settlement.png` | 5,374,165 | 2752×1536 | `5CFF75C3C9E0A0D2A89D7FAD5F539049A7F94ECBE49B57F9EB67BB8819740F49` | Viewed; generated ticket exploration | `DUPLICATE_OR_SUPERSEDED` |
| F-061 | `docs/design/ticket-directions/05-boarding-pass.png` | 4,793,802 | 2752×1536 | `9B93C1D8319A6BAAD05B5073EC29F51BD5E3F148A540AF5561D4912AC984151D` | Viewed; generated ticket exploration | `DUPLICATE_OR_SUPERSEDED` |
| F-062 | `docs/design/ticket-directions/06-swiss-riso.png` | 5,290,759 | 2752×1536 | `20A0979D7D70CCF2FA755E3D185FD49638887550F41FF733540112FD0A44DC68` | Viewed; generated ticket exploration | `DUPLICATE_OR_SUPERSEDED` |

## Initial ignored/runtime files — 3

| ID | Path | Bytes | SHA-256 | Use / risk | Canonicality | Disposition |
|---|---|---:|---|---|---|---|
| F-063 | `.remember/.gitignore` | 2 | `CDBCAE15105D6B781E620813C79C7E868740D4E9CC53CE6F5FCBBC12387ADF4B` | Contains `*`; excludes remember runtime material | Tool configuration, not product | `EXCLUDED_SECURITY_TECH_PRODUCT` |
| F-064 | `.remember/logs/hook-errors.log` | 0 | `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855` | Empty hook error log | Runtime output, not evidence of product behavior | `EXCLUDED_SECURITY_TECH_PRODUCT` |
| F-065 | `.remember/logs/memory-2026-07-21.log` | 297,348 | `5E729752DB9462DB7FC302DAD4BB7292210A39451C42ADA76EB8D3F3D7D635A6` | 1,219 hook metadata lines; contains host paths but no detected credential pattern | Runtime/host metadata, never commit or deploy | `EXCLUDED_SECURITY_TECH_PRODUCT` |

## Initial directories — 15

Directories are not included in the 65-file disposition totals, but each initial directory is explicit here.

| ID | Path | Initial contents / purpose | Disposition |
|---|---|---|---|
| D-001 | `.agents/` | Empty; no repository-local agent instruction | Exclude as empty tool directory |
| D-002 | `.remember/` | Ignored remember plugin state | Exclude from product/commit |
| D-003 | `.remember/logs/` | Hook logs | Exclude from product/commit |
| D-004 | `.remember/logs/autonomous/` | Empty | Exclude as runtime directory |
| D-005 | `.remember/tmp/` | Empty | Exclude as runtime directory |
| D-006 | `docs/` | Product, review, design, engineering and verification documents | Retain as documentation |
| D-007 | `docs/design/` | Visual canonical and legacy design references | Retain with per-file authority |
| D-008 | `docs/design/assets/` | Generated reference boards | Retain reference-only; never ship verbatim |
| D-009 | `docs/design/concepts-10/` | CUTLINE concept comparison board | Retain design evidence only |
| D-010 | `docs/design/ticket-concepts-10/` | Archived ticket comparison board | Retain as superseded evidence |
| D-011 | `docs/design/ticket-concepts-10/exports/` | Ten archived 1080×1350 exports | Retain as superseded evidence |
| D-012 | `docs/design/ticket-directions/` | Six generated ticket explorations | Retain as superseded evidence |
| D-013 | `docs/engineering/` | Legacy engineering contracts | Retain history; v3 wins conflicts |
| D-014 | `docs/prompts/` | Current v3.2 execution prompts | Implement current contracts |
| D-015 | `docs/verification/` | Legacy test/QA plans | Retain scenarios; replace conflicting pass rules with v3 evidence |

## Post-baseline material — not part of the initial 65

| ID | Path | Provenance | Treatment |
|---|---|---|---|
| P-001 | `.remember/logs/memory-2026-07-22.log` | Automatically created by the existing remember hook during the read-only audit; 233 bytes when first measured; SHA-256 `D715B5780C4D265A2B2783EB2DEB867B47C057B2250B6585B328D792715A8BA2` at that observation | Preserve, ignore, never use as product/release evidence; hash may change if the hook appends later |
| P-002 | `RELEASE_BUILD_PLAN.md` | Created after the forensic snapshot by the release implementation run | Current run plan; intentionally excluded from pre-change counts |
| P-003 | `MATERIAL_INVENTORY.md` | This audit record | New release evidence; intentionally excluded from pre-change counts |
| P-004 | `MD_READ_LEDGER.md` | Companion Markdown audit record | New release evidence; intentionally excluded from pre-change counts |

## Referenced external and unavailable material

| ID | Path | Observation | Authority / use | Disposition |
|---|---|---|---|---|
| X-001 | `C:\Users\agape\Desktop\코딩\코덱스프롬프트.txt` | Accessible, 41,246 bytes, SHA-256 `9E647CDD1C15E7B38F9F2C6D80C5084A0053FC15A0356EE67F26B43AFA44A28B`, no detected secret pattern | Generic repository-review prompt referenced by `QA_MATRIX.md`; supplies QA categories, not product behavior. Its “only write `.gpt5.6sol.md`” instruction is superseded by the current user request. | `DOC_DESIGN_TEST_OPS` |
| X-002 | `C:\Users\agape\.config\git\ignore` | Git warned `Permission denied`; content and hash unavailable | A global-ignore rule could affect Git's ignored classification, but direct forced filesystem enumeration still covered the project tree | `BLOCKED_EXTERNAL` |

## Explicit anomalies and non-silent exclusions

1. `docs/design/assets/session-strip-concept-board.png` is referenced by two Markdown links but is absent under that name. F-040 (`최종.png`) has the exact expected SHA-256. Preserve the Korean-named original; an English byte-identical alias may be added only as a new implementation file.
2. F-037 and F-059 are byte-identical. Both are preserved because one is user material under a separate path; F-037 is not silently deleted as duplication.
3. The generated visual boards contain obsolete four-tab navigation, public/indexable sharing, QR, exact-looking values, or legacy styling. Those elements are evidence of exploration, not requirements. `FINAL_BLUEPRINT.md` and `VISUAL_MOTION_DIRECTION.md` decide what is implemented.
4. The six HTML/CSS/JS files are mocks. Their successful JavaScript syntax checks do not count as application build, unit, integration, E2E, accessibility or deployment evidence.
5. No initial `package.json`, lockfile, application source tree, migration, CI/CD, `.env.example`, manifest, service worker or real automated test existed. Therefore no initial material is marked `ALREADY_SATISFIED`.
6. Known credential/private-key/JWT patterns were absent. One current handoff document contains a third-party business contact address; the value is intentionally not reproduced here and must not enter application telemetry or bundles.
