import '@testing-library/jest-dom/vitest'
import '../i18n/init'

class MockIntersectionObserver implements IntersectionObserver {
	readonly root = null
	readonly rootMargin = ''
	readonly thresholds = []

	disconnect() {}

	observe() {}

	takeRecords() {
		return []
	}

	unobserve() {}
}

globalThis.IntersectionObserver = MockIntersectionObserver

class MockResizeObserver implements ResizeObserver {
	disconnect() {}

	observe() {}

	unobserve() {}
}

globalThis.ResizeObserver = MockResizeObserver

// jsdom does not implement the Pointer Capture API used by gesture controls.
if (!HTMLElement.prototype.setPointerCapture) {
	HTMLElement.prototype.setPointerCapture = () => {}
}
if (!HTMLElement.prototype.releasePointerCapture) {
	HTMLElement.prototype.releasePointerCapture = () => {}
}
if (!HTMLElement.prototype.hasPointerCapture) {
	HTMLElement.prototype.hasPointerCapture = () => false
}
