import '@testing-library/jest-dom/vitest'

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
