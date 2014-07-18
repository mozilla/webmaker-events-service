# Contribution Guidelines

## Reporting issues

- **Search for existing issues.** Please check to see if someone else has reported the same issue.
- **Share as much information as possible.** Include operating system and version, browser and version. Also, include steps to reproduce the bug.

## Project Setup

Refer to the [README](https://github.com/mozilla/webmaker-events-service/blob/master/README.md).

## Code Style

### JavaScript

JS files must pass JSHint using the provided [.jshintrc](https://raw.github.com/mozilla/webmaker-events-service/master/.jshintrc) settings.

Additionally, JS files need to be run through [JSBeautify](https://github.com/einars/js-beautify) with the provided [.jsbeautifyrc](https://raw.github.com/mozilla/webmaker-events-service/master/.jsbeautifyrc).

**TL;DR** Run `grunt clean` before pushing a commit. It will validate and beautify your JS.

#### Variable Naming

- `lowerCamelCase` General variables
- `UpperCamelCase` Constructor functions
- Use semantic and descriptive variables names (e.g. `colors` *not* `clrs` or `c`). Avoid abbreviations except in cases of industry wide usage (e.g. `AJAX` and `JSON`).

## Pull requests

- Try not to pollute your pull request with unintended changes – keep them simple and small. If possible, squash your commits.
- Try to share which browsers and devices your code has been tested in before submitting a pull request.
- If your PR resolves an issue, include **closes #ISSUE_NUMBER** in your commit message (or a [synonym](https://help.github.com/articles/closing-issues-via-commit-messages)).
