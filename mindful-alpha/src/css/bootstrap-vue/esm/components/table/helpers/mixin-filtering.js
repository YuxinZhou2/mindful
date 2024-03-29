import cloneDeep from '../../../utils/clone-deep';
import looseEqual from '../../../utils/loose-equal';
import { concat } from '../../../utils/array';
import { isFunction, isString, isRegExp } from '../../../utils/inspect';
import { warn } from '../../../utils/warn';
import stringifyRecordValues from './stringify-record-values';
var DEPRECATED_DEBOUNCE = 'b-table: Prop "filter-debounce" is deprecated. Use the debounce feature of <b-form-input> instead';
export default {
  props: {
    filter: {
      type: [String, RegExp, Object, Array],
      default: null
    },
    filterFunction: {
      type: Function,
      default: null
    },
    filterIgnoredFields: {
      type: Array // default: undefined

    },
    filterIncludedFields: {
      type: Array // default: undefined

    },
    filterDebounce: {
      type: [Number, String],
      deprecated: DEPRECATED_DEBOUNCE,
      default: 0,
      validator: function validator(val) {
        return /^\d+/.test(String(val));
      }
    }
  },
  data: function data() {
    return {
      // Flag for displaying which empty slot to show and some event triggering
      isFiltered: false,
      // Where we store the copy of the filter criteria after debouncing
      // We pre-set it with the sanitized filter value
      localFilter: this.filterSanitize(this.filter)
    };
  },
  computed: {
    computedFilterIgnored: function computedFilterIgnored() {
      return this.filterIgnoredFields ? concat(this.filterIgnoredFields).filter(Boolean) : null;
    },
    computedFilterIncluded: function computedFilterIncluded() {
      return this.filterIncludedFields ? concat(this.filterIncludedFields).filter(Boolean) : null;
    },
    computedFilterDebounce: function computedFilterDebounce() {
      var ms = parseInt(this.filterDebounce, 10) || 0;
      /* istanbul ignore next */

      if (ms > 0) {
        warn(DEPRECATED_DEBOUNCE);
      }

      return ms;
    },
    localFiltering: function localFiltering() {
      return this.hasProvider ? !!this.noProviderFiltering : true;
    },
    // For watching changes to `filteredItems` vs `localItems`
    filteredCheck: function filteredCheck() {
      return {
        filteredItems: this.filteredItems,
        localItems: this.localItems,
        localFilter: this.localFilter
      };
    },
    // Sanitized/normalize filter-function prop
    localFilterFn: function localFilterFn() {
      // Return `null` to signal to use internal filter function
      return isFunction(this.filterFunction) ? this.filterFunction : null;
    },
    // Returns the records in `localItems` that match the filter criteria
    // Returns the original `localItems` array if not sorting
    filteredItems: function filteredItems() {
      var items = this.localItems || []; // Note the criteria is debounced and sanitized

      var criteria = this.localFilter; // Resolve the filtering function, when requested
      // We prefer the provided filtering function and fallback to the internal one
      // When no filtering criteria is specified the filtering factories will return `null`

      var filterFn = this.localFiltering ? this.filterFnFactory(this.localFilterFn, criteria) || this.defaultFilterFnFactory(criteria) : null; // We only do local filtering when requested and there are records to filter

      return filterFn && items.length > 0 ? items.filter(filterFn) : items;
    }
  },
  watch: {
    // Watch for debounce being set to 0
    computedFilterDebounce: function computedFilterDebounce(newVal, oldVal) {
      if (!newVal && this.$_filterTimer) {
        clearTimeout(this.$_filterTimer);
        this.$_filterTimer = null;
        this.localFilter = this.filterSanitize(this.filter);
      }
    },
    // Watch for changes to the filter criteria, and debounce if necessary
    filter: {
      // We need a deep watcher in case the user passes
      // an object when using `filter-function`
      deep: true,
      handler: function handler(newCriteria, oldCriteria) {
        var _this = this;

        var timeout = this.computedFilterDebounce;
        clearTimeout(this.$_filterTimer);
        this.$_filterTimer = null;

        if (timeout && timeout > 0) {
          // If we have a debounce time, delay the update of `localFilter`
          this.$_filterTimer = setTimeout(function () {
            _this.localFilter = _this.filterSanitize(newCriteria);
          }, timeout);
        } else {
          // Otherwise, immediately update `localFilter` with `newFilter` value
          this.localFilter = this.filterSanitize(newCriteria);
        }
      }
    },
    // Watch for changes to the filter criteria and filtered items vs `localItems`
    // Set visual state and emit events as required
    filteredCheck: function filteredCheck(_ref) {
      var filteredItems = _ref.filteredItems,
          localItems = _ref.localItems,
          localFilter = _ref.localFilter;
      // Determine if the dataset is filtered or not
      var isFiltered = false;

      if (!localFilter) {
        // If filter criteria is falsey
        isFiltered = false;
      } else if (looseEqual(localFilter, []) || looseEqual(localFilter, {})) {
        // If filter criteria is an empty array or object
        isFiltered = false;
      } else if (localFilter) {
        // If filter criteria is truthy
        isFiltered = true;
      }

      if (isFiltered) {
        this.$emit('filtered', filteredItems, filteredItems.length);
      }

      this.isFiltered = isFiltered;
    },
    isFiltered: function isFiltered(newVal, oldVal) {
      if (newVal === false && oldVal === true) {
        // We need to emit a filtered event if isFiltered transitions from true to
        // false so that users can update their pagination controls.
        this.$emit('filtered', this.localItems, this.localItems.length);
      }
    }
  },
  created: function created() {
    var _this2 = this;

    // Create non-reactive prop where we store the debounce timer id
    this.$_filterTimer = null; // If filter is "pre-set", set the criteria
    // This will trigger any watchers/dependents
    // this.localFilter = this.filterSanitize(this.filter)
    // Set the initial filtered state in a `$nextTick()` so that
    // we trigger a filtered event if needed

    this.$nextTick(function () {
      _this2.isFiltered = Boolean(_this2.localFilter);
    });
  },
  beforeDestroy: function beforeDestroy()
  /* istanbul ignore next */
  {
    clearTimeout(this.$_filterTimer);
    this.$_filterTimer = null;
  },
  methods: {
    filterSanitize: function filterSanitize(criteria) {
      // Sanitizes filter criteria based on internal or external filtering
      if (this.localFiltering && !this.localFilterFn && !(isString(criteria) || isRegExp(criteria))) {
        // If using internal filter function, which only accepts string or RegExp,
        // return '' to signify no filter
        return '';
      } // Could be a string, object or array, as needed by external filter function
      // We use `cloneDeep` to ensure we have a new copy of an object or array
      // without Vue's reactive observers


      return cloneDeep(criteria);
    },
    // Filter Function factories
    filterFnFactory: function filterFnFactory(filterFn, criteria) {
      // Wrapper factory for external filter functions
      // Wrap the provided filter-function and return a new function
      // Returns `null` if no filter-function defined or if criteria is falsey
      // Rather than directly grabbing `this.computedLocalFilterFn` or `this.filterFunction`
      // we have it passed, so that the caller computed prop will be reactive to changes
      // in the original filter-function (as this routine is a method)
      if (!filterFn || !isFunction(filterFn) || !criteria || looseEqual(criteria, []) || looseEqual(criteria, {})) {
        return null;
      } // Build the wrapped filter test function, passing the criteria to the provided function


      var fn = function fn(item) {
        // Generated function returns true if the criteria matches part
        // of the serialized data, otherwise false
        return filterFn(item, criteria);
      }; // Return the wrapped function


      return fn;
    },
    defaultFilterFnFactory: function defaultFilterFnFactory(criteria) {
      var _this3 = this;

      // Generates the default filter function, using the given filter criteria
      // Returns `null` if no criteria or criteria format not supported
      if (!criteria || !(isString(criteria) || isRegExp(criteria))) {
        // Built in filter can only support strings or RegExp criteria (at the moment)
        return null;
      } // Build the regexp needed for filtering


      var regexp = criteria;

      if (isString(regexp)) {
        // Escape special `RegExp` characters in the string and convert contiguous
        // whitespace to `\s+` matches
        var pattern = criteria.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/[\s\uFEFF\xA0]+/g, '\\s+'); // Build the `RegExp` (no need for global flag, as we only need
        // to find the value once in the string)

        regexp = new RegExp(".*".concat(pattern, ".*"), 'i');
      } // Generate the wrapped filter test function to use


      var fn = function fn(item) {
        // This searches all row values (and sub property values) in the entire (excluding
        // special `_` prefixed keys), because we convert the record to a space-separated
        // string containing all the value properties (recursively), even ones that are
        // not visible (not specified in this.fields)
        // Users can ignore filtering on specific fields, or on only certain fields,
        // and can optionall specify searching results of fields with formatter
        //
        // TODO: Enable searching on scoped slots (optional, as it will be SLOW)
        //
        // Generated function returns true if the criteria matches part of
        // the serialized data, otherwise false
        // We set `lastIndex = 0` on the `RegExp` in case someone specifies the `/g` global flag
        regexp.lastIndex = 0;
        return regexp.test(stringifyRecordValues(item, _this3.computedFilterIgnored, _this3.computedFilterIncluded, _this3.computedFieldsObj));
      }; // Return the generated function


      return fn;
    }
  }
};