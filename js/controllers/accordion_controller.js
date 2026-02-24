import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel"]

  toggle(event) {
    const header = event.currentTarget
    const panel = header.closest("h3").nextElementSibling
    const isOpen = !panel.hidden

    // Close all panels
    this.panelTargets.forEach(function(p) { p.hidden = true })
    this.element.querySelectorAll(".accHeader").forEach(function(h) {
      h.setAttribute("aria-expanded", "false")
    })

    // Open clicked panel if it was closed (collapsible behavior)
    if (!isOpen) {
      panel.hidden = false
      header.setAttribute("aria-expanded", "true")
    }
  }
}
