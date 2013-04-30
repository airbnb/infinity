ListView = infinity.ListView
ListItem = infinity.ListItem
ELEMENT_SELECTOR = '#test'

describe 'ListItem', ->
  $el = $ ELEMENT_SELECTOR
  lv = null

  beforeEach -> lv = new ListView $el
  afterEach -> lv.remove()

  it 'should be returned from an append', ->
    $content = $ '<br>'
    item = lv.append $content
    expect(item).to.be.a(ListItem)

  it 'should be returned from a preppend', ->
    $content = $ '<br>'
    item = lv.prepend $content
    expect(item).to.be.a(ListItem)

  it 'should remove itself from the parent ListView when removed', ->
    $content = $ '<br>'
    item = lv.append $content
    item.remove()
    find = lv.find $content
    expect(find.length).to.be(0)

