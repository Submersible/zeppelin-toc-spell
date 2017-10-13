
import {
    SpellBase,
    SpellResult,
    DefaultDisplayType,
} from 'zeppelin-spell';

const $ = window.$;
const _ = window._;
const selector = [1, 2, 3, 4, 5, 6].map(x => `#content .paragraph h${x}`).join(', ');

export default class TOCSpell extends SpellBase {
    constructor() {
        super("%toc");
        main();
    }

    interpret(paragraphText) {
        return new SpellResult(''); // @TODO return entire TOC
    }
}

function main() {
    // destroy last setup toc plugin
    if (window.toc_destroy) {
        window.toc_destroy();
    }

    // setup plugin
    const $rootScope = angular.element(document.body).injector().get('$rootScope');
    const $toc = injectSidebar();
    const $contents = $toc.find('.toc-contents');
    const $headroom = $('headroom');
    const $body = $('body');
    let $notebookController = null;
    let listeners = [];
    injectCSS();

    const refreshPinned = throttle({ms: 50}, () => {
        const pinned = !$headroom.hasClass('headroom--unpinned');
        if (pinned) {
            $toc.removeClass('toc-unpinned').addClass('toc-pinned');
        } else {
            $toc.removeClass('toc-pinned').addClass('toc-unpinned');
        }
    })

    const refreshSidebarContents = throttle({ms: 50}, () => {
        injectNotebookController();
        if ($notebookController) {
            const headers = parseHeaders();
            if (headers.children.length) {
                $toc.css({display: 'block'});
                $contents.html(renderHeaders(headers));
                $body.addClass('toc-sidebar-shown');
            } else {
                $toc.css({display: 'none'});
                $body.removeClass('toc-sidebar-shown');
            }
        }
    });

    function injectNotebookController() {
        if ($notebookController) {
            return;
        }
    
        const element = $('.notebookContent');
        if (!element.length) {
            return
        }
        $notebookController = angular.element(element[0]).scope();

        // hide sidebar when no longer looking at notebook
        listeners.push($notebookController.$on('$destroy', () => {
            $toc.css({display: 'none'});
            $contents.html('');
            listeners = [];
            $notebookController = null;
        }));
    }

    // watch when notebook changes to refresh sidebar
    ['$routeChangeStart', 'resultRendered', 'updateResult', 'moveParagraphUp', 'moveFocusToNextParagraph', 'moveParagraphDown'].forEach((name) => {
        listeners.push($rootScope.$on(name, () => setTimeout(() => refreshSidebarContents(), 50)));
    });

    // watch when headroom disappears
    if ($headroom.length) {
        const observer = new MutationObserver(refreshPinned);
        observer.observe($headroom[0], {attributes: true});
    }

    // destroy listeners on notebook leave
    window.toc_destroy = () => {
        $('.toc-root').remove();
        try { listeners.forEach(f => f()); } catch (e) {}
        try { observer.disconnect(); } catch (e) {}
    }

    // refresh sidebar on load
    refreshSidebarContents()
    refreshPinned();
}

function throttle({ms}, f) {
    const fThrottled = _.throttle(f, ms);
    const fDebounced = _.debounce(f, ms + 50);
    return () => { fThrottled(); fDebounced(); }
}

function parseHeaders() {
    const headers = Array.prototype.slice.call(document.querySelectorAll(selector), 0);

    // build element hierarchy from header levels
    const toc = {parent: null, children: [], depth: 0};
    let last = toc;

    for (let element of headers) {
        const title = parseHeaderTitle(element);
        const depth = parseInt(element.nodeName[1], 10);
        const item = {title, children: [], depth, element};

        while (last.depth >= depth) {
            last = last.parent;
        }

        item.parent = last;
        last.children.push(item);
        last = item;
    }

    return toc;
}

function renderHeaders(header, index=[]) {
    let ol = document.createElement('ol');
    let i = 1;
    for (let child of header.children) {
        ol.appendChild(renderHeaders(child, index.concat([i])))
        i += 1;
    }

    if (header.depth === 0) {
        return ol;
    }

    let element = document.createElement('li')
    let a = document.createElement('a');
    a.className = 'btnText toc-link';

    let header_number = header.element.querySelector('.toc-header-number');
    if (!header_number) {
        header_number = $('<span class="toc-header-number">')[0]
        $(header.element).prepend(header_number)
    }
    $(header_number).text(`${index.join('.')} `)

    let title = document.createElement('span');
    title.className = 'toc-title';
    title.innerText = header.title;
    a.onclick = () => {
        scrollToHeader(header.element);
        runFocusHeaderAnimation(header.element);
    }
    a.innerHTML = `<span class="toc-number">${index.join('.')}</span> `;
    a.appendChild(title);
    element.appendChild(a);
    element.appendChild(ol);
    return element;
}

function scrollToHeader(element) {
    const top_offset_for_floating_nav_bar = 130;
    $(window).scrollTop($(element).offset().top - top_offset_for_floating_nav_bar);
}

function runFocusHeaderAnimation(element) {
    element.className = element.className.replace(/(\s+)?\btoc-header-focus\b(\s+)?/g, '');
    setTimeout(() => {
        element.className += ' toc-header-focus';
    }, 10);
}

function parseHeaderTitle(element) {
    return (
        Array.prototype.slice.call(element.childNodes, 0)
        .filter(x => !(x.className || '').match('toc-header-number'))
        .map(x => x.textContent)
        .join(' ').trim()
    )
}

function injectSidebar() {
    return $(`
        <div id="toc" class="toc-root toc-sidebar">
            <div class="box toc-box"> 
                <h4 class="toc-title">Contents</h4>
                <div class="toc-scroll toc-contents"></div>
            </div>
        </div>
    `).appendTo('body');
}

function injectCSS() {
    $(`
        <style class="toc-root">
            .toc-sidebar-shown #content {
                margin-left: 227px;
            }

            .toc-sidebar {
                display: none;
                position: fixed;
                left: 0;
                top: 115px;
                bottom: 0;
                transition: all .2s ease-in-out;
            }
            #toc.toc-unpinned {
                top: -1px;
            }
            #toc .toc-box {
                height: 100%;
                width: 230px;
                padding-bottom: 45px;
                margin-bottom: 0;
                border-left: 0;
                border-bottom: 0;
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                border-bottom-right-radius: 0;
            }
            #toc.toc-unpinned .toc-box {
                border-top-right-radius: 0;
            }
            #toc .toc-title {
                margin-top: 0;
            }
            #toc .toc-scroll {
                height: 100%;
                white-space: nowrap;
                overflow: scroll;
            }
            #toc ol {
                padding-left: 0px;
                margin-left: 0px;
                font-size: 12px;
                list-style-type: none;        
            }
            #toc ol ol {
                padding-left: 10px;
            }
            #toc .toc-number {
                opacity: 0.5;
            }
            #toc .toc-link {
                cursor: pointer;
                color: black;
            }

            .toc-header-focus { animation: toc-focus-header-animation 1s; }
            @keyframes toc-focus-header-animation {
                0% { background-color: #b5d5ff; }
                100% { background-color: inherit; }
            }
        </style>
    `).appendTo('head')
}
