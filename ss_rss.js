(function () {
    'use strict';

    if (window.lampa_rss_ticker) return;
    window.lampa_rss_ticker = true;

    // =============================================
    // ИСТОЧНИКИ RSS ПО КАТЕГОРИЯМ
    // =============================================
    var RSS_FEEDS = {
        cinema: {
            label: 'Кино и сериалы',
            urls: [
                'https://www.kinonews.ru/rss/',
                'https://dtf.ru/rss/cinema'
            ]
        },
        sport: {
            label: 'Спорт',
            urls: [
                'https://www.sports.ru/rss/all_news.xml',
                'https://www.championat.com/xml/news.xml'
            ]
        },
        tech: {
            label: 'Технологии',
            urls: [
                'https://3dnews.ru/news/rss/',
                'https://habr.com/ru/rss/news/?fl=ru',
                'https://www.ixbt.com/export/news.rss'
            ]
        },
        politics: {
            label: 'Политика',
            urls: [
                'https://lenta.ru/rss/news',
                'https://ria.ru/export/rss2/archive/index.xml'
            ]
        },
        world: {
            label: 'Мир / Общество',
            urls: [
                'https://tass.ru/rss/v2.xml',
                'https://rg.ru/xml/index.xml'
            ]
        },
        science: {
            label: 'Наука',
            urls: [
                'https://naked-science.ru/feed',
                'https://indicator.ru/feed/'
            ]
        }
    };

    // =============================================
    // ДЕФОЛТНЫЕ НАСТРОЙКИ
    // =============================================
    var DEFAULTS = {
        rss_enabled:    true,
        rss_cinema:     true,
        rss_sport:      false,
        rss_tech:       true,
        rss_politics:   false,
        rss_world:      false,
        rss_science:    false,
        rss_custom_1:   '',
        rss_custom_2:   '',
        rss_custom_3:   '',
        rss_speed:      '60',
        rss_text_color: '#ffffff',
        rss_bg_color:   '#000000',
        rss_opacity:    '0.75',
        rss_separator:  '  ✦  ',
        rss_position:   'bottom',
        rss_height:     '36',
        rss_show_date:  true,
        rss_show_source: true,
        rss_shuffle:    true
    };

    function get(key) {
        var v = Lampa.Storage.get(key);
        if (v === undefined || v === null) return DEFAULTS[key];
        // Storage может вернуть строку "true"/"false" — нормализуем
        if (v === 'true')  return true;
        if (v === 'false') return false;
        return v;
    }
    function set(key, val) { Lampa.Storage.set(key, val); }

    // Инициализируем дефолты при первом запуске
    Object.keys(DEFAULTS).forEach(function (k) {
        if (Lampa.Storage.get(k) === undefined) set(k, DEFAULTS[k]);
    });

    // =============================================
    // DOM БЕГУЩЕЙ СТРОКИ
    // =============================================
    var $container, $inner;
    var _animFrame, _animStart, _totalWidth, _speed;

    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    // Размер шрифта автоматически от высоты строки (~58%)
    function fontSizeFromHeight(height) {
        return Math.round(height * 0.58);
    }

    function applyStyles() {
        if (!$container) return;
        var opacity  = parseFloat(get('rss_opacity')) || 0.75;
        var bgHex    = get('rss_bg_color') || '#000000';
        var rgb      = hexToRgb(bgHex);
        var height   = parseInt(get('rss_height')) || 36;
        var fontSize = fontSizeFromHeight(height);
        var pos      = get('rss_position') === 'top' ? 'top' : 'bottom';

        $container.css({
            background: 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + opacity + ')',
            height: height + 'px',
            lineHeight: height + 'px',
            top:    pos === 'top'    ? '0'    : '',
            bottom: pos === 'bottom' ? '0'    : '',
            fontSize: fontSize + 'px'
        });
        $inner.css({ color: get('rss_text_color') || '#ffffff' });

        if (!get('rss_enabled')) {
            $container.hide();
        } else {
            $container.show();
            restartAnimation();
        }
    }

    function buildDOM() {
        if ($('#rss-ticker-wrap').length) return;

        $('head').append('<style id="rss-ticker-style">' +
            '#rss-ticker-wrap {' +
            '  position: fixed; left: 0; width: 100%; z-index: 9999;' +
            '  overflow: hidden; white-space: nowrap; pointer-events: none;' +
            '  box-shadow: 0 0 12px rgba(0,0,0,0.6);' +
            '}' +
            '#rss-ticker-inner { display: inline-block; padding-left: 100vw; will-change: transform; }' +
        '</style>');

        $('body').append(
            '<div id="rss-ticker-wrap">' +
            '  <span id="rss-ticker-inner">Загрузка новостей...</span>' +
            '</div>'
        );

        $container = $('#rss-ticker-wrap');
        $inner     = $('#rss-ticker-inner');

        applyStyles();
    }

    // =============================================
    // АНИМАЦИЯ (requestAnimationFrame)
    // =============================================
    function stopAnimation() {
        if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    }

    function restartAnimation() {
        stopAnimation();
        if (!$inner || !$inner.length) return;
        _speed     = parseInt(get('rss_speed')) || 60;   // px/sec
        _totalWidth = $inner[0].scrollWidth + window.innerWidth;
        _animStart  = null;

        function step(ts) {
            if (!_animStart) _animStart = ts;
            var elapsed = ts - _animStart;
            var px = (_speed * elapsed / 1000) % _totalWidth;
            $inner.css('transform', 'translateX(-' + px + 'px)');
            _animFrame = requestAnimationFrame(step);
        }
        _animFrame = requestAnimationFrame(step);
    }

    // =============================================
    // ЗАГРУЗКА RSS
    // =============================================
    var _fetchTimer;

    function collectUrls() {
        var urls = [];
        Object.keys(RSS_FEEDS).forEach(function (cat) {
            if (get('rss_' + cat)) {
                urls = urls.concat(RSS_FEEDS[cat].urls);
            }
        });
        ['rss_custom_1', 'rss_custom_2', 'rss_custom_3'].forEach(function (k) {
            var v = (get(k) || '').trim();
            if (v && v.indexOf('http') === 0) urls.push(v);
        });
        return urls;
    }

    // Форматирует pubDate в короткий вид: "8 мая"
    function formatDate(pubDateStr) {
        if (!pubDateStr) return '';
        try {
            var d = new Date(pubDateStr);
            if (isNaN(d.getTime())) return '';
            var months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
            return d.getDate() + ' ' + months[d.getMonth()];
        } catch (e) { return ''; }
    }

    // Извлекает короткое имя домена из URL: "habr.com"
    function sourceName(url) {
        try {
            return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        } catch (e) { return ''; }
    }

    function parseXml(xmlText, feedUrl) {
        try {
            var doc   = new DOMParser().parseFromString(xmlText, 'text/xml');
            var items = doc.querySelectorAll('item');
            var results = [];
            var showDate   = get('rss_show_date');
            var showSource = get('rss_show_source');
            var src = sourceName(feedUrl);

            for (var i = 0; i < Math.min(items.length, 6); i++) {
                var titleEl = items[i].querySelector('title');
                if (!titleEl || !titleEl.textContent) continue;

                var title = titleEl.textContent.trim();

                // Дата
                var rawDate = '';
                var pubEl = items[i].querySelector('pubDate') || items[i].querySelector('pubdate');
                if (pubEl) rawDate = pubEl.textContent;
                if (!rawDate) {
                    var dcDate = items[i].getElementsByTagNameNS('*', 'date')[0];
                    if (dcDate) rawDate = dcDate.textContent;
                }
                var dateStr = formatDate(rawDate);

                // Формат: "8 мая, sports.ru — текст"
                var prefix = '';
                if (showDate && dateStr && showSource && src) {
                    prefix = dateStr + ', ' + src + ' — ';
                } else if (showDate && dateStr) {
                    prefix = dateStr + ' — ';
                } else if (showSource && src) {
                    prefix = src + ' — ';
                }

                results.push(prefix + title);
            }
            return results;
        } catch (e) { return []; }
    }

    // Перемешивает массивы по принципу round-robin (чередование категорий)
    function interleave(arrays) {
        var result = [];
        var maxLen = 0;
        arrays.forEach(function (a) { if (a.length > maxLen) maxLen = a.length; });
        for (var i = 0; i < maxLen; i++) {
            arrays.forEach(function (a) {
                if (i < a.length) result.push(a[i]);
            });
        }
        return result;
    }

    function fetchAll() {
        if (!get('rss_enabled')) return;
        var urls = collectUrls();
        if (!urls.length) {
            setText('Включите хотя бы одну категорию RSS в настройках плагина.');
            return;
        }

        var buckets = [];   // массив массивов — по одному на каждый url
        var done = 0;

        urls.forEach(function (url, idx) {
            buckets[idx] = [];
            fetch(url, { cache: 'no-store' })
                .then(function (r) { return r.text(); })
                .then(function (xml) {
                    buckets[idx] = parseXml(xml, url);
                })
                .catch(function () {})
                .finally(function () {
                    done++;
                    if (done >= urls.length) {
                        var headlines;
                        if (get('rss_shuffle')) {
                            // Чередуем новости из разных источников
                            headlines = interleave(buckets.filter(function (b) { return b.length > 0; }));
                        } else {
                            // Просто по порядку
                            headlines = [];
                            buckets.forEach(function (b) { headlines = headlines.concat(b); });
                        }
                        if (headlines.length) {
                            setText(headlines.join(get('rss_separator') || '  ✦  '));
                        } else {
                            setText('Не удалось загрузить новости. Проверьте подключение.');
                        }
                    }
                });
        });
    }

    function setText(str) {
        if (!$inner) return;
        $inner.text(str);
        restartAnimation();
    }

    function scheduleRefresh() {
        clearTimeout(_fetchTimer);
        fetchAll();
        _fetchTimer = setInterval(fetchAll, 20 * 60 * 1000); // каждые 20 мин
    }

    // =============================================
    // НАСТРОЙКИ — регистрация через SettingsApi
    // =============================================
    var SPEED_OPTS    = { '30': 'Медленно', '60': 'Нормально', '100': 'Быстро', '150': 'Очень быстро' };
    var OPACITY_OPTS  = { '0.3': '30%', '0.5': '50%', '0.75': '75%', '0.9': '90%', '1': '100%' };
    var COLOR_OPTS    = { '#ffffff': 'Белый', '#000000': 'Чёрный', '#ffff00': 'Жёлтый', '#00ff00': 'Зелёный', '#00ffff': 'Голубой', '#ff4444': 'Красный', '#ff8800': 'Оранжевый' };
    var HEIGHT_OPTS   = { '28': 'Узкая (28px)', '36': 'Стандарт (36px)', '44': 'Широкая (44px)', '54': 'Очень широкая (54px)' };
    var POS_OPTS      = { 'bottom': 'Снизу', 'top': 'Сверху' };
    var SEP_OPTS      = { '  ✦  ': '✦ Звёздочка', '  |  ': '| Черта', '  •  ': '• Точка', '  >>>  ': '>>> Стрелки', '   ': 'Пробел' };

    function registerSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'rss_ticker',
            name: 'RSS Бегущая строка',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 15.64A2.18 2.18 0 0 1 8.36 17.82C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82A2.18 2.18 0 0 1 6.18 15.64M4 4.44A15.56 15.56 0 0 1 19.56 20H16.73A12.73 12.73 0 0 0 4 7.27V4.44M4 10.1A9.9 9.9 0 0 1 13.9 20H11.07A7.07 7.07 0 0 0 4 12.93V10.1Z"/></svg>'
        });

        // --- Вкл/выкл ---
        Lampa.SettingsApi.addParam({
            component: 'rss_ticker',
            param: { name: 'rss_enabled', type: 'trigger', default: true },
            field: { name: 'Включить бегущую строку' },
            onChange: function () { applyStyles(); scheduleRefresh(); }
        });

        // --- Категории ---
        Object.keys(RSS_FEEDS).forEach(function (cat) {
            Lampa.SettingsApi.addParam({
                component: 'rss_ticker',
                param: { name: 'rss_' + cat, type: 'trigger', default: DEFAULTS['rss_' + cat] },
                field: { name: RSS_FEEDS[cat].label, description: 'Категория новостей' },
                onChange: function () { scheduleRefresh(); }
            });
        });

        // --- Кастомные источники ---
        function addCustomInput(key, label) {
            Lampa.SettingsApi.addParam({
                component: 'rss_ticker',
                param: { name: key, type: 'trigger', default: '' },
                field: { name: label, description: get(key) || 'Нажмите для ввода URL' },
                onRender: function (item) {
                    item.find('.settings-param__value').text(get(key) ? 'Задан' : 'Не задан');
                    item.on('hover:enter', function () {
                        Lampa.Input.edit(
                            { title: label + ' (RSS XML URL)', value: get(key) || '', free: true, nosave: true },
                            function (val) {
                                set(key, val.trim());
                                item.find('.settings-param__value').text(val.trim() ? 'Задан' : 'Не задан');
                                scheduleRefresh();
                            }
                        );
                    });
                }
            });
        }
        addCustomInput('rss_custom_1', 'Свой источник 1');
        addCustomInput('rss_custom_2', 'Свой источник 2');
        addCustomInput('rss_custom_3', 'Свой источник 3');

        // --- Внешний вид ---
        function addSelect(key, label, opts, desc) {
            Lampa.SettingsApi.addParam({
                component: 'rss_ticker',
                param: { name: key, type: 'select', values: opts, default: DEFAULTS[key] },
                field: { name: label, description: desc || '' },
                onChange: function () { applyStyles(); }
            });
        }

        addSelect('rss_position',  'Положение',          POS_OPTS,      'Сверху или снизу экрана');
        addSelect('rss_height',    'Высота строки',       HEIGHT_OPTS,   '');
        addSelect('rss_speed',     'Скорость прокрутки',  SPEED_OPTS,    'px/сек');
        addSelect('rss_text_color','Цвет текста',         COLOR_OPTS,    '');
        addSelect('rss_bg_color',  'Цвет фона',           COLOR_OPTS,    '');
        addSelect('rss_opacity',   'Прозрачность фона',   OPACITY_OPTS,  '');
        addSelect('rss_separator', 'Разделитель новостей', SEP_OPTS,     '');

        Lampa.SettingsApi.addParam({
            component: 'rss_ticker',
            param: { name: 'rss_show_date', type: 'trigger', default: true },
            field: { name: 'Показывать дату новости', description: 'Например: 8 мая' },
            onChange: function () { scheduleRefresh(); }
        });
        Lampa.SettingsApi.addParam({
            component: 'rss_ticker',
            param: { name: 'rss_show_source', type: 'trigger', default: true },
            field: { name: 'Показывать источник', description: 'Например: sports.ru' },
            onChange: function () { scheduleRefresh(); }
        });
        Lampa.SettingsApi.addParam({
            component: 'rss_ticker',
            param: { name: 'rss_shuffle', type: 'trigger', default: true },
            field: { name: 'Перемешивать новости', description: 'Чередовать источники: спорт, кино, техно, спорт...' },
            onChange: function () { scheduleRefresh(); }
        });
    }

    // =============================================
    // СКРЫВАТЬ ВО ВРЕМЯ ВОСПРОИЗВЕДЕНИЯ
    // =============================================
    function bindPlayerEvents() {
        // Lampa player events
        Lampa.Listener.follow('player', function (e) {
            if (!$container) return;
            if (e.type === 'start' || e.type === 'play') {
                $container.hide();
            }
            if (e.type === 'destroy' || e.type === 'stop') {
                if (get('rss_enabled')) $container.show();
            }
        });

        // Резервный способ: MutationObserver следит за появлением тега video в DOM
        var _playerObserver = new MutationObserver(function () {
            if (!$container) return;
            var hasVideo = !!document.querySelector('video');
            if (hasVideo) {
                $container.hide();
            } else {
                if (get('rss_enabled')) $container.show();
            }
        });
        _playerObserver.observe(document.body, { childList: true, subtree: true });
    }

    // =============================================
    // СТАРТ
    // =============================================
    function init() {
        registerSettings();
        buildDOM();
        scheduleRefresh();
        bindPlayerEvents();
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }

})();
