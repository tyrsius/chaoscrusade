define(['knockout', 'jquery'], function(ko, $) {

    var install = function() {
        //Command objects
        ko.command = function (options) {
            var
                self = function () {
                    return self.execute.apply(this, arguments);
                },
                canExecuteDelegate = options.canExecute,
                executeDelegate = options.execute;

            self.canExecute = ko.computed(function () {
                return canExecuteDelegate ? canExecuteDelegate() : true;
            });

            self.execute = function (arg1, arg2) {
                // Needed for anchors since they don't support the disabled state
                if (!self.canExecute()) return

                return executeDelegate.apply(this, [arg1, arg2]);
            };

            return self;
        };

        ko.qCommand = function (options) {
            var self = function () {
                return self.execute.apply(this, arguments);
            };
            
            var canExecuteDelegate = options.canExecute,
                executeDelegate = options.execute;

            self.isExecuting = ko.observable();

            self.canExecute = ko.computed(function () {
                return canExecuteDelegate ? canExecuteDelegate(self.isExecuting()) : !self.isExecuting();
            });

            self.execute = function (arg1, arg2) {
                // Needed for anchors since they don't support the disabled state
                if (!self.canExecute())
                    return null;

                self.isExecuting(true);

                //We can't return this and have a done() handler from the normal
                //execute.
                Q.fapply(executeDelegate, [arg1, arg2]).then(function () {
                    self.isExecuting(false);
                }).done();
            };

            return self;
        };

        //Command Bindings
        ko.utils.wrapAccessor = function (accessor) {
            return function () {
                return accessor;
            };
        };

        ko.bindingHandlers.command = {
            init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                var
                    value = valueAccessor(),
                    commands = value.execute ? { click: value } : value,

                    isBindingHandler = function (handler) {
                        return ko.bindingHandlers[handler] !== undefined;
                    },

                    initBindingHandlers = function () {
                        for (var command in commands) {
                            if (!isBindingHandler(command)) {
                                continue;
                            };

                            ko.bindingHandlers[command].init(
                                element,
                                ko.utils.wrapAccessor(commands[command].execute),
                                allBindingsAccessor,
                                viewModel
                            );
                        }
                    },

                    initEventHandlers = function () {
                        var events = {};

                        for (var command in commands) {
                            if (!isBindingHandler(command)) {
                                events[command] = commands[command].execute;
                            }
                        }

                        ko.bindingHandlers.event.init(
                            element,
                            ko.utils.wrapAccessor(events),
                            allBindingsAccessor,
                            viewModel);
                    };

                initBindingHandlers();
                initEventHandlers();
            },

            update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
                var commands = valueAccessor();
                var canExecute = commands.canExecute;

                if (!canExecute) {
                    for (var command in commands) {
                        if (commands[command].canExecute) {
                            canExecute = commands[command].canExecute;
                            break;
                        }
                    }
                }

                if (!canExecute) {
                    return;
                }

                ko.bindingHandlers.enable.update(element, canExecute, allBindingsAccessor, viewModel);
            }
        };

        //Knockout activity
        $.fn.activity = function (opts) {
            this.each(function () {
                var $this = $(this);
                var el = $this.data('activity');
                if (el) {
                    clearInterval(el.data('interval'));
                    el.remove();
                    $this.removeData('activity');
                }
                if (opts !== false) {
                    opts = $.extend({ color: $this.css('color') }, $.fn.activity.defaults, opts);

                    el = render($this, opts).css('position', 'absolute').prependTo(opts.outside ? 'body' : $this);
                    var h = $this.outerHeight() - el.height();
                    var w = $this.outerWidth() - el.width();
                    var margin = {
                        top: opts.valign == 'top' ? opts.padding : opts.valign == 'bottom' ? h - opts.padding : Math.floor(h / 2),
                        left: opts.align == 'left' ? opts.padding : opts.align == 'right' ? w - opts.padding : Math.floor(w / 2)
                    };
                    var offset = $this.offset();
                    if (opts.outside) {
                        el.css({ top: offset.top + 'px', left: offset.left + 'px' });
                    }
                    else {
                        margin.top -= el.offset().top - offset.top;
                        margin.left -= el.offset().left - offset.left;
                    }
                    el.css({ marginTop: margin.top + 'px', marginLeft: margin.left + 'px' });
                    animate(el, opts.segments, Math.round(10 / opts.speed) / 10);
                    $this.data('activity', el);
                }
            });
            return this;
        };

        $.fn.activity.defaults = {
            segments: 12,
            space: 3,
            length: 7,
            width: 4,
            speed: 1.2,
            align: 'center',
            valign: 'center',
            padding: 4
        };

        $.fn.activity.getOpacity = function (opts, i) {
            var steps = opts.steps || opts.segments - 1;
            var end = opts.opacity !== undefined ? opts.opacity : 1 / steps;
            return 1 - Math.min(i, steps) * (1 - end) / steps;
        };

        /**
         * Default rendering strategy. If neither SVG nor VML is available, a div with class-name 'busy' 
         * is inserted, that can be styled with CSS to display an animated gif as fallback.
         */
        var render = function () {
            return $('<div>').addClass('busy');
        };

        /**
         * The default animation strategy does nothing as we expect an animated gif as fallback.
         */
        var animate = function () {
        };

        /**
         * Utility function to create elements in the SVG namespace.
         */
        function svg(tag, attr) {
            var el = document.createElementNS("http://www.w3.org/2000/svg", tag || 'svg');
            if (attr) {
                $.each(attr, function (k, v) {
                    el.setAttributeNS(null, k, v);
                });
            }
            return $(el);
        }

        if (document.createElementNS && document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect) {

            // =======================================================================================
            // SVG Rendering
            // =======================================================================================

            /**
             * Rendering strategy that creates a SVG tree.
             */
            render = function (target, d) {
                var innerRadius = d.width * 2 + d.space;
                var r = (innerRadius + d.length + Math.ceil(d.width / 2) + 1);

                var el = svg().width(r * 2).height(r * 2);

                var g = svg('g', {
                    'stroke-width': d.width,
                    'stroke-linecap': 'round',
                    stroke: d.color
                }).appendTo(svg('g', { transform: 'translate(' + r + ',' + r + ')' }).appendTo(el));

                for (var i = 0; i < d.segments; i++) {
                    g.append(svg('line', {
                        x1: 0,
                        y1: innerRadius,
                        x2: 0,
                        y2: innerRadius + d.length,
                        transform: 'rotate(' + (360 / d.segments * i) + ', 0, 0)',
                        opacity: $.fn.activity.getOpacity(d, i)
                    }));
                }
                return $('<div>').append(el).width(2 * r).height(2 * r);
            };

            // Check if Webkit CSS animations are available, as they work much better on the iPad
            // than setTimeout() based animations.

            if (document.createElement('div').style.WebkitAnimationName !== undefined) {

                var animations = {};

                /**
                 * Animation strategy that uses dynamically created CSS animation rules.
                 */
                animate = function (el, steps, duration) {
                    if (!animations[steps]) {
                        var name = 'spin' + steps;
                        var rule = '@-webkit-keyframes ' + name + ' {';
                        for (var i = 0; i < steps; i++) {
                            var p1 = Math.round(100000 / steps * i) / 1000;
                            var p2 = Math.round(100000 / steps * (i + 1) - 1) / 1000;
                            var value = '% { -webkit-transform:rotate(' + Math.round(360 / steps * i) + 'deg); }\n';
                            rule += p1 + value + p2 + value;
                        }
                        rule += '100% { -webkit-transform:rotate(100deg); }\n}';
                        document.styleSheets[0].insertRule(rule);
                        animations[steps] = name;
                    }
                    el.css('-webkit-animation', animations[steps] + ' ' + duration + 's linear infinite');
                };
            }
            else {

                /**
                 * Animation strategy that transforms a SVG element using setInterval().
                 */
                animate = function (el, steps, duration) {
                    var rotation = 0;
                    var g = el.find('g g').get(0);
                    el.data('interval', setInterval(function () {
                        g.setAttributeNS(null, 'transform', 'rotate(' + (++rotation % steps * (360 / steps)) + ')');
                    }, duration * 1000 / steps));
                };
            }

        }
        else {

            // =======================================================================================
            // VML Rendering
            // =======================================================================================

            var s = $('<shape>').css('behavior', 'url(#default#VML)');

            $('body').append(s);

            if (s.get(0).adj) {

                // VML support detected. Insert CSS rules for group, shape and stroke.
                var sheet = document.createStyleSheet();
                $.each(['group', 'shape', 'stroke'], function () {
                    sheet.addRule(this, "behavior:url(#default#VML);");
                });

                /**
                 * Rendering strategy that creates a VML tree. 
                 */
                render = function (target, d) {

                    var innerRadius = d.width * 2 + d.space;
                    var r = (innerRadius + d.length + Math.ceil(d.width / 2) + 1);
                    var s = r * 2;
                    var o = -Math.ceil(s / 2);

                    var el = $('<group>', { coordsize: s + ' ' + s, coordorigin: o + ' ' + o }).css({ top: o, left: o, width: s, height: s });
                    for (var i = 0; i < d.segments; i++) {
                        el.append($('<shape>', { path: 'm ' + innerRadius + ',0  l ' + (innerRadius + d.length) + ',0' }).css({
                            width: s,
                            height: s,
                            rotation: (360 / d.segments * i) + 'deg'
                        }).append($('<stroke>', { color: d.color, weight: d.width + 'px', endcap: 'round', opacity: $.fn.activity.getOpacity(d, i) })));
                    }
                    return $('<group>', { coordsize: s + ' ' + s }).css({ width: s, height: s, overflow: 'hidden' }).append(el);
                };

                /**
                 * Animation strategy that modifies the VML rotation property using setInterval().
                 */
                animate = function (el, steps, duration) {
                    var rotation = 0;
                    var g = el.get(0);
                    el.data('interval', setInterval(function () {
                        g.style.rotation = ++rotation % steps * (360 / steps);
                    }, duration * 1000 / steps));
                };
            }
            $(s).remove();
        }

        (function ($) {
            "use strict";

            /* ACTIVITY INDICATOR EXTENDED CLASS DEFINITION
            * ========================= */
            var Indicator = function ($element) {
                this.$element = $element;
                this.onlyIcon = this.$element.contents().length === 1 && this.$element.children('i').length === 1;
                this.activityText = this.$element.data('activity-text');
                this.isIndicatorOnly = this.$element.is('i');
                this.icons = this.$element.children('i');
            };

            Indicator.prototype = {
                createTemporaryIcon: function () {
                    if (this.onlyIcon)
                        return;
                    //this.temporaryIcon = $('<i class="icon-" style="padding-left: 5px"></i>');
                    this.temporaryIcon = $('<i style="display: inline-block; padding-left: 5px; width: 14px;"></i>');
                    this.$element.append(this.temporaryIcon);
                },

                hideExistingIcons: function () {
                    if (this.onlyIcon)
                        this.icons.css('visibility', 'hidden');
                },

                moveSpinnerToFront: function () {
                    $('body > div, body > group').first().css('z-index', 9999);
                },

                removeTemporaryIcon: function () {
                    if (!this.temporaryIcon)
                        return;

                    this.temporaryIcon.remove();
                    this.temporaryIcon = null;
                },

                setText: function (state) {
                    if (!this.activityText)
                        return;
                    var data = this.$element.data(),
                        val = this.$element.is('input') ? 'val' : 'html';
                    if (state === 'activity')
                        this.$element.data('resetText', this.$element[val]());
                    this.$element[val](data[state + 'Text']);
                },

                showExistingIcons: function () {
                    this.icons.css('visibility', 'visible');
                },

                start: function () {
                    this.isBusy = true;
                    this.setText('activity');
                    this.createTemporaryIcon();
                    this.hideExistingIcons();
                    if (this.$element.is('button'))
                        this.$element.addClass('disabled').attr('disabled', 'disabled');
                    this.$element.activity({
                        align: this.onlyIcon || this.isIndicatorOnly ? 'center' : 'right',
                        length: this.isIndicatorOnly ? 5 : 2,
                        padding: 12,
                        outside: true,
                        segments: this.isIndicatorOnly ? 12 : 10,
                        space: this.isIndicatorOnly ? 2 : 1,
                        width: 1.5
                    });
                    this.moveSpinnerToFront();
                },

                stop: function () {
                    this.removeTemporaryIcon();
                    this.showExistingIcons();
                    this.isBusy = false;
                    this.setText('reset');
                    this.$element.activity(false);
                    this.$element.removeClass('disabled').removeAttr('disabled');
                },

                update: function (isLoading) {
                    if (isLoading && !this.isBusy) {
                        this.start();
                    }

                    if (!isLoading && this.isBusy) {
                        this.stop();
                    }
                }
            };

            /* ACTIVITY INDICATOR EXTENDED PLUGIN DEFINITION
            * ========================== */

            $.fn.activityEx = function (isLoading) {
                var activity = function ($element) {
                    if (!isLoading) {
                        $element.activity(false);
                        return;
                    }

                    var length = Math.round($element.height() / 4);
                    var isInput = $element.is('input');

                    $element.activity({
                        align: $element.is('input') ? 'right' : 'center',
                        length: length,
                        padding: isInput ? length : 0,
                        outside: true,
                        segments: Math.max(10, 10 + (length - 5)),
                        space: 1,
                        width: 1.5
                    });
                    $('body > div').first().css('z-index', 9999);
                },
                    buttonActivity = function ($element) {
                        var data = $element.data('activityEx');
                        if (!data)
                            $element.data('activityEx', (data = new Indicator($element)));
                        data.update(isLoading);
                    };
                return this.each(function () {
                    $(this).is('button, input, a') ? buttonActivity($(this)) : activity($(this));
                });
            };
        })($);

        //Activity Bindings
        ko.bindingHandlers.activity = {
            init: function (element) {
                ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
                    $(element).activityEx(false);
                });
            },

            update: function (element, valueAccessor) {
                var activity = valueAccessor()();
                typeof activity !== 'boolean' || $(element).activityEx(activity);
            }
        }

    };

    return {
        install: install
    };
});