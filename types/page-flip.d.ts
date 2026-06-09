declare module 'page-flip' {
  export class PageFlip {
    constructor(block: HTMLElement, setting: Record<string, number | string | boolean>)
    destroy(): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    getCurrentPageIndex(): number
    loadFromHTML(items: HTMLElement[]): void
    on(eventName: string, callback: (event: {
      data: number | string | boolean | object | null
    }) => void): PageFlip
    update(): void
  }
}
