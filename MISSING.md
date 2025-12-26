# Missing Features and Remaining Issues

## Status: Complete

All 112 compliance tests are now passing. The parser is fully compliant with the provided test suite (`tests1.dat`).

### Resolved Issues

1.  **`IN_FRAMESET` Mode**: Implemented `IN_FRAMESET` and `AFTER_FRAMESET` insertion modes to handle frameset parsing correctly (Tests 105, 112).
2.  **Adoption Agency / Foster Parenting**: Fixed complex edge cases involving the Adoption Agency algorithm and table foster parenting (Tests 31, 78, 91, 102) by ensuring correct stack cleanup when the algorithm is invoked.
