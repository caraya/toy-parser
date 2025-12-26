# Missing Features and Remaining Issues

Implementing the missing features and fixing remaining bugs presents varying levels of difficulty:

## 2. Remaining Adoption Agency / Table Bugs (Hard)

The other failures (Tests 31, 78, 91, 102) are not due to "missing features" but rather **complex edge cases** in the existing logic.

* **Difficulty**: Hard.
* **Context**: These involve the interaction between two of the most complicated parts of the HTML spec:
  * **Adoption Agency Algorithm**: Re-parenting misnested formatting tags (like `<a>` or `<b>`).
  * **Foster Parenting**: Moving elements out of tables when they appear in the wrong place.
* **Challenge**: Getting these to work perfectly together requires extremely precise adherence to the spec's stack manipulation rules.

## Summary

With `IN_FRAMESET` support added, the parser is now compliant with the majority of the test suite (108/112 passing). Fixing the remaining 4 edge-case failures is the difficult part.
