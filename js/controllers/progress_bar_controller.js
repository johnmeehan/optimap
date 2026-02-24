import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["bar"]

  setValue(pct) {
    this.barTarget.value = pct
    this.barTarget.setAttribute("aria-valuenow", pct)
  }

  // Allow setting value via custom event from tsp.js
  connect() {
    this._setValueHandler = function(e) {
      this.setValue(e.detail.value)
    }.bind(this)
    this.element.addEventListener("progress:setValue", this._setValueHandler)
  }

  disconnect() {
    this.element.removeEventListener("progress:setValue", this._setValueHandler)
  }
}
