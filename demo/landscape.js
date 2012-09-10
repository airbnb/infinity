var TEST_URLS = [
      "http://media-cache-ec5.pinterest.com/upload/123849058472175652_vqM3nf2k_b.jpg"
    , "http://media-cache-lt0.pinterest.com/upload/172966441909503305_ayvyoHco_b.jpg"
    , "http://media-cache-ec4.pinterest.com/upload/155374255865181811_S9jOe9L3_b.jpg"
    , "http://media-cache-lt0.pinterest.com/upload/38069559319607369_H4eJX4ux_b.jpg"
    , "http://media-cache-ec2.pinterest.com/upload/262827328223090631_Reiq2GkT_b.jpg"
    , "http://media-cache0.pinterest.com/upload/223913412693834183_80gZlczN_b.jpg"
    , "http://media-cache-ec5.pinterest.com/upload/247416573248285079_2OSmDuJf_b.jpg"
    ];

var templateItem = _.template("<div class='item'> \
<div class='item-text'><%- text %></div> \
<img data-original='<%- imgurl %>' /> \
</div>");

jQuery(document).ready(function($) {
        
    var $el = $('.slider');
    var listView = new infinity.ListView($el, {
        landscape: true,
        height: 200,
        lazy: function() {
            $('.item img', this).each(function() {
                var $ref = $(this);
                $ref.attr('src', $ref.attr('data-original'));
            });
        }
    });
    
    var itemCount = 40;
    for (var i = 0; i<itemCount; i++) {
        var index = Math.floor(Math.random() * TEST_URLS.length),
            imgUrl = TEST_URLS[index],
            item = templateItem({
                imgurl: imgUrl,
                text: i+1
            });
        listView.append($(item));       
    }

});
