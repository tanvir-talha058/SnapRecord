# Contributing to SnapRecord

First off, thank you for considering contributing to SnapRecord! It's people like you that make SnapRecord such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by respect and professionalism. Please be kind and courteous in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what you expected to see
- **Include screenshots or GIFs** if applicable
- **Include your browser version** and operating system

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any alternatives** you've considered

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes:
   ```bash
   git commit -m 'Add some amazing feature'
   ```
6. Push to your branch:
   ```bash
   git push origin feature/amazing-feature
   ```
7. Open a Pull Request

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/tanvir-talha058/SnapRecord.git
   cd SnapRecord
   ```

2. Load the extension in your browser:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `SnapRecord` folder

3. Make your changes and test them

4. Reload the extension to see your changes:
   - Go to `chrome://extensions/`
   - Click the refresh icon on the SnapRecord card

## Coding Standards

### JavaScript

- Use modern ES6+ syntax
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Avoid global variables when possible

### HTML/CSS

- Use semantic HTML5 elements
- Keep CSS organized and modular
- Use consistent naming conventions
- Ensure responsive design
- Follow accessibility best practices

### File Structure

```
SnapRecord/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── popup.html/css/js      # Popup interface
├── options.html/js        # Settings page
├── icons/                 # Extension icons
└── README.md             # Documentation
```

## Testing

Before submitting a PR, please test:

1. **All recording modes** (Screen, Tab, Window)
2. **Audio options** (Microphone, System Audio, both, neither)
3. **Controls** (Start, Stop, Pause, Resume)
4. **Settings** (Verify preferences are saved and applied)
5. **Edge cases** (Cancel recording dialog, permissions denied, etc.)

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests liberally

Examples:
```
Add pause/resume functionality
Fix timer calculation during pause
Update README with installation instructions
```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Ensure your code follows the coding standards
3. Your PR will be reviewed by maintainers
4. Address any feedback or requested changes
5. Once approved, your PR will be merged

## Feature Requests

We're always looking for ways to improve SnapRecord. Some areas where contributions are especially welcome:

- **Performance improvements**
- **Additional recording features** (annotations, webcam overlay, etc.)
- **Better error handling**
- **UI/UX enhancements**
- **Documentation improvements**
- **Internationalization (i18n)**
- **Accessibility improvements**
- **Browser compatibility**

## Questions?

Don't hesitate to ask questions by opening an issue with the "question" label.

## License

By contributing to SnapRecord, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to SnapRecord! 🎉
