# Pull Request Template

## Summary
A concise description of the change.
(One–three sentences. What is added, changed, or fixed?)

## Related Issue
- Closes: #ISSUE_ID
(If no issue exists, describe why this PR is standalone.)

## Type of Change
Select one:

- [ ] Feature (dev/)
- [ ] Bug Fix (fix/)
- [ ] Refactor (refactor/)
- [ ] Documentation (docs/)
- [ ] Test (test/)
- [ ] Chore (chore/maintenance)

## Description
Detailed explanation of:
- What was done
- Why it was needed
- Any design decisions or trade-offs
- Notes for reviewers

## Testing
Describe how the change was tested:
- [ ] Manual test
- [ ] Unit tests added/updated
- [ ] Not tested yet (explain why)

(Optional: commands, test cases, screenshots)

## Checklist
- [ ] My commit messages follow the project’s Commit Conventions
- [ ] Code builds without errors
- [ ] Tests pass
- [ ] Documentation updated if needed
- [ ] Branch is up to date with `main`

## Additional Notes
(Optional) Anything else reviewers should know, context, risks, or future TODOs.


## Example

```md

## Summary
Add JSON serialization support for the internal configuration structure.
This enables saving and loading user-defined settings.

## Related Issue
- Closes: #12

## Type of Change
- [x] Feature (dev/)
- [ ] Bug Fix (fix/)
- [ ] Refactor (refactor/)
- [ ] Documentation (docs/)
- [ ] Test (test/)
- [ ] Chore (chore/maintenance)

## Description
This PR introduces a new module `src/config/json_serializer.py`.

Key changes:
- Added `to_json()` and `from_json()` functions for converting the `Config` data structure to/from JSON.
- Introduced minimal validation to ensure required fields exist.
- Added error handling for malformed JSON input.
- Updated the `Config` class to include a `to_dict()` helper method used by the serializer.

Design considerations:
- Avoided adding dependencies; uses Python's built-in `json` module.
- Kept serialization logic separate from the core `Config` class to maintain separation of concerns.

## Testing
- [x] Manual test
- [x] Unit tests added/updated
- [ ] Not tested yet

Manual Tests:
- Verified that saving a config file produces valid JSON.
- Verified that loading from JSON restores the configuration state accurately.

Unit Tests:
- Added `tests/test_json_serializer.py`
- Coverage includes valid input, missing fields, and malformed JSON handling.

## Checklist
- [x] My commit messages follow the project’s Commit Conventions
- [x] Code builds without errors
- [x] Tests pass
- [x] Documentation updated if needed
- [x] Branch is up to date with `main`

## Additional Notes
The validation layer is intentionally minimal; richer schema validation may be added later if necessary.
This PR prepares the foundation for future support of custom config formats.
```