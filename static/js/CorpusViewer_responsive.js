var switch_timeout;

var switchCorpusViewerLayout = function(switch_width) {

    if (switch_width == undefined) {
        switch_width = 1024;
    }
    var window_width = window.innerWidth;
    // Activate narrow layout
    if (window_width < switch_width) {
//        document.getElementById("sidebar").className = "span4 spanv10";
        document.getElementById("left_sidebar_top").className = "span4 spanv5";
        document.getElementById("left_sidebar_bottom").className = "span4 spanv5 alpha-vertical-left";
        document.getElementById("main").className = "span8 spanv6";
        document.getElementById("right_sidebar_top").className = "span4 spanv4 omega-vertical offset4";
        document.getElementById("right_sidebar_bottom").className = "span4 spanv4 omega-vertical-right offset8";
    }
    // Re-activate widescreen layout
    else {
//        document.getElementById("sidebar").className = "span2 spanv10";
        document.getElementById("left_sidebar_top").className = "span2 spanv5";
        document.getElementById("left_sidebar_bottom").className = "span2 spanv5 alpha-vertical-left";
        document.getElementById("main").className = "span8 spanv10";
        document.getElementById("right_sidebar_top").className = "span2 spanv5 omega";
        document.getElementById("right_sidebar_bottom").className = "span2 spanv5 omega-vertical-right";
    }
}

switchCorpusViewerLayout();

window.addEventListener("resize", function() {
    clearTimeout(switch_timeout);
    switch_timeout = setTimeout(switchCorpusViewerLayout, 250);
}, false);
