import { contains, eventOff, eventOn } from '../utils/dom';
var eventOptions = {
  passive: true,
  capture: false
}; // @vue/component

export default {
  data: function data() {
    return {
      listenForClickOut: false
    };
  },
  watch: {
    listenForClickOut: function listenForClickOut(newValue, oldValue) {
      if (newValue !== oldValue) {
        eventOff(this.clickOutElement, this.clickOutEventName, this._clickOutHandler, eventOptions);

        if (newValue) {
          eventOn(this.clickOutElement, this.clickOutEventName, this._clickOutHandler, eventOptions);
        }
      }
    }
  },
  beforeCreate: function beforeCreate() {
    // Declare non-reactive properties
    this.clickOutElement = null;
    this.clickOutEventName = null;
  },
  mounted: function mounted() {
    if (!this.clickOutElement) {
      this.clickOutElement = document;
    }

    if (!this.clickOutEventName) {
      this.clickOutEventName = 'ontouchstart' in document.documentElement ? 'touchstart' : 'click';
    }

    if (this.listenForClickOut) {
      eventOn(this.clickOutElement, this.clickOutEventName, this._clickOutHandler, eventOptions);
    }
  },
  beforeDestroy: function beforeDestroy()
  /* istanbul ignore next */
  {
    eventOff(this.clickOutElement, this.clickOutEventName, this._clickOutHandler, eventOptions);
  },
  methods: {
    isClickOut: function isClickOut(evt) {
      return !contains(this.$el, evt.target);
    },
    _clickOutHandler: function _clickOutHandler(evt) {
      if (this.clickOutHandler && this.isClickOut(evt)) {
        this.clickOutHandler(evt);
      }
    }
  }
};