ListView = infinity.ListView
ELEMENT_SELECTOR = '#test'

describe 'ListView', ->
  $el = $ ELEMENT_SELECTOR
  lv = null

  beforeEach ->
    lv = new ListView $el
  afterEach ->
    lv.remove()

  it 'should be able to be added and removed from an element', ->
    lv.remove()
    expect($(ELEMENT_SELECTOR).length).to.be(1)
    expect($(ELEMENT_SELECTOR).children().length).to.be(0)

  it 'should be initialized with no height', ->
    expect(lv.height).to.be(0)
    expect($el.height()).to.be(0)

  it 'should find things appended to it with a CSS selector', ->
    $content = $ '<div class=test></div>'
    lv.append $content
    find = lv.find '.test'
    expect(find[0].$el).to.be($content)

  it 'should find things prepended to it with a CSS selector', ->
    $content = $ '<div class=test></div>'
    lv.prepend $content
    find = lv.find '.test'
    expect(find[0].$el).to.be($content)

  it 'should find things appended to it given a jQuery element', ->
    $content = $ '<div></div>'
    lv.append($content)
    find = lv.find $content
    expect(find[0].$el).to.be($content)

  it 'should find things prepended to it given a jQuery element', ->
    $content = $ '<div></div>'
    lv.prepend($content)
    find = lv.find $content
    expect(find[0].$el).to.be($content)

  it 'should find things appended to it given a different jQuery element wrapping the same DOM node', ->
    $content = $ '<div id=hello></div>'
    lv.append($content)
    $contentFromJQ = $('#hello')
    find = lv.find $contentFromJQ
    expect(find[0].$el.is($content)).to.be.ok()

  it 'should find things prepended to it given a different jQuery element wrapping the same DOM node', ->
    $content = $ '<div id=hello></div>'
    lv.prepend($content)
    $contentFromJQ = $('#hello')
    find = lv.find $contentFromJQ
    expect(find[0].$el.is($content)).to.be.ok()
