import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.resize()
    this._resizeHandler = this.resize.bind(this)
    window.addEventListener("resize", this._resizeHandler)
  }

  disconnect() {
    window.removeEventListener("resize", this._resizeHandler)
  }

  resize() {
    this.element.style.height = (window.innerHeight - 100) + "px"
  }
}
