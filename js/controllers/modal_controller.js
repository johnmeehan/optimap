import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["backdrop"]

  open() {
    this.element.classList.add("is-open")
    document.body.classList.add("modal-open")
  }

  close() {
    this.element.classList.remove("is-open")
    document.body.classList.remove("modal-open")
  }

  backdropClick(event) {
    if (event.target === event.currentTarget) {
      this.close()
    }
  }

  // Allow opening/closing via custom events dispatched from tsp.js
  connect() {
    this._openHandler = this.open.bind(this)
    this._closeHandler = this.close.bind(this)
    this.element.addEventListener("modal:open", this._openHandler)
    this.element.addEventListener("modal:close", this._closeHandler)
  }

  disconnect() {
    this.element.removeEventListener("modal:open", this._openHandler)
    this.element.removeEventListener("modal:close", this._closeHandler)
  }
}
