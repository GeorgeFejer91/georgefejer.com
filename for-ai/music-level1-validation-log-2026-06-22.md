# Music And Level 1 Validation Log - 2026-06-22

Validation target: `einhorn-sammler/index.html`

Change validated:

- Background music now rotates forever between three browser-playable MP3 arcade variants.
- Level 1 was retuned as an introductory level with slower witch pressure, a longer start window, fewer evil moving-tree gates, and a more open maze.

URL:

`http://127.0.0.1:4177/einhorn-sammler/?aitest=1&runs=8&seconds=120&tick=55&v=music-l1-validation`

Result:

- Asset version: `20260622-music-l1-v1`
- Total emulated runs: `40`
- Levels tested: `5`
- Minimum success rate: `0.75`
- Moving-tree overlap failures: `0`
- Browser console errors: `0`

| Level | Completed | Success Rate | Avg Seconds | Avg Difficulty | Lives Lost | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 8/8 | 1.00 | 31.8 | 17.9 | 0.0 | playable |
| 2 | 6/8 | 0.75 | 53.1 | 51.9 | 0.9 | playable |
| 3 | 6/8 | 0.75 | 58.0 | 82.8 | 1.0 | playable |
| 4 | 6/8 | 0.75 | 68.4 | 92.6 | 1.3 | playable |
| 5 | 7/8 | 0.88 | 61.3 | 95.9 | 0.9 | playable |

Level 1 is now intentionally forgiving and should stay that way unless a full all-level validation pass still clears the pass criteria.
