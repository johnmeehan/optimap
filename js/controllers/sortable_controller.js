import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

export default class extends Controller {
  connect() {
    this.sortable = Sortable.create(this.element, {
      animation: 150,
      onEnd: this.onEnd.bind(this)
    })
  }

  disconnect() {
    if (this.sortable) {
      this.sortable.destroy()
    }
  }

  onEnd() {
    var ids = Array.from(this.element.children).map(function(el) { return el.id })
    var numPerm = new Array(ids.length + 2)
    numPerm[0] = 0
    for (var i = 0; i < ids.length; i++) {
      numPerm[i + 1] = parseInt(ids[i])
    }
    numPerm[numPerm.length - 1] = numPerm.length - 1
    this.dispatch("reordered", { detail: { order: numPerm } })
  }
}
