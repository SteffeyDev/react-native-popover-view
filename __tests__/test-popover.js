import React from 'react'
import { View, Text } from 'react-native'
import { shallow, configure } from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'
import Popover, { Point, Rect } from '../Popover'

configure({ adapter: new Adapter() })

describe('Test Basic Lifecycle', () => {
  it('renders as expected', () => {
    const wrapper = shallow(
      <Popover>
        <View style={{width: 200, height: 200}}><Text>Hi</Text></View>
      </Popover>
    )
    expect(wrapper).toMatchSnapshot()
    wrapper.setProps({isVisible: true})
    expect(wrapper).toMatchSnapshot()
    wrapper.setProps({showInModal: false})
    expect(wrapper).toMatchSnapshot()
  })

  it('doneClosingCallback test', () => {
    let doneClosingCallback = () => {}
    const wrapper = shallow(
      <Popover doneClosingCallback={doneClosingCallback}>
        <View style={{width: 200, height: 200}}><Text>Hi</Text></View>
      </Popover>
    )
    wrapper.setProps({isVisible: true})
    setTimeout(() => {
      wrapper.setProps({isVisible: false})
      setTimeout(() => expect(doneClosingCallback).toHaveBeenCalled(), 400)
    }, 500)
  })
})

const testPlacement = ({fromRect, placement, popoverOrigin, anchorPoint}) => {
  let contentSize = {width: 200, height: 200}

  const wrapper = shallow(
    <Popover
      displayArea={{x: 0, y: 0, width: 400, height: 400}}
    >
      <View style={contentSize}><Text>Hi</Text></View>
    </Popover>
  )

  if (fromRect)
    wrapper.setProps({fromRect})
  wrapper.instance().measureContent({
    nativeEvent: {
      layout: contentSize 
    }
  })

  expect(wrapper.state('requestedContentSize')).toBe(contentSize)
  if (placement)
    expect(wrapper.state('placement')).toEqual(placement)
  expect(wrapper.state('popoverOrigin')).toEqual(popoverOrigin)
  expect(wrapper.state('anchorPoint')).toEqual(anchorPoint)
  expect(wrapper.state('forcedContentSize')).toEqual({width: 200, height: 200})
}

describe('Test Placement', () => {
  it('no fromRect', () => {
    testPlacement({
      popoverOrigin: new Point(100, 100),
      anchorPoint: new Point(200, 200),
    })
  })

  // *
  //   -----
  //   |   |
  //   -----
  it('with fromRect - top left', () => {

    testPlacement({
      fromRect: new Rect(-100, -100, 20, 20),
      placement: 'right',
      popoverOrigin: new Point(8, 0),
      anchorPoint: new Point(0, 8)
    })
  })

  //   -----
  // * |   |
  //   -----
  it('with fromRect - center left', () => {
    testPlacement({
      fromRect: new Rect(-100, 190, 20, 20),
      placement: 'right',
      popoverOrigin: new Point(8, 100),
      anchorPoint: new Point(0, 200)
    })
  })

  //   -----
  //   |   |
  //   -----
  // *
  it('with fromRect - bottom left', () => {
    testPlacement({
      fromRect: new Rect(-100, 500, 20, 20),
      placement: 'right',
      popoverOrigin: new Point(8, 200),
      anchorPoint: new Point(0, 400 - 8)
    })
  })

  //   -----
  //   |   |
  //   -----
  //     *
  it('with fromRect - center bottom', () => {
    testPlacement({
      fromRect: new Rect(190, 500, 20, 20),
      placement: 'top',
      popoverOrigin: new Point(100, 200 - 8),
      anchorPoint: new Point(200, 400)
    })
  })

  //   -----
  //   |   |
  //   -----
  //         *
  it('with fromRect - bottom right', () => {
    testPlacement({
      fromRect: new Rect(500, 500, 20, 20),
      placement: 'left',
      popoverOrigin: new Point(200 - 8, 200),
      anchorPoint: new Point(400, 400 - 8)
    })
  })

  //   -----
  //   |   | *
  //   -----
  it('with fromRect - center bottom', () => {
    testPlacement({
      fromRect: new Rect(500, 190, 20, 20),
      placement: 'left',
      popoverOrigin: new Point(200 - 8, 100),
      anchorPoint: new Point(400, 200)
    })
  })

  //         *
  //   -----
  //   |   |
  //   -----
  it('with fromRect - top right', () => {
    testPlacement({
      fromRect: new Rect(500, -100, 20, 20),
      placement: 'left',
      popoverOrigin: new Point(200 - 8, 0),
      anchorPoint: new Point(400, 8)
    })
  })

  //     *
  //   -----
  //   |   |
  //   -----
  it('with fromRect - center top', () => {
    testPlacement({
      fromRect: new Rect(190, -100, 20, 20),
      placement: 'bottom',
      popoverOrigin: new Point(100, 8),
      anchorPoint: new Point(200, 0)
    })
  })

  //   -----
  //   | * |
  //   |   |
  //   -----
  it('with fromRect - center top inside', () => {
    testPlacement({
      fromRect: new Rect(190, 80, 20, 20),
      placement: 'bottom',
      popoverOrigin: new Point(100, 100 + 8),
      anchorPoint: new Point(200, 100)
    })
  })

  //   -----
  //   |*  |
  //   -----
  it('with fromRect - center left inside', () => {
    testPlacement({
      fromRect: new Rect(80, 190, 20, 20),
      placement: 'right',
      popoverOrigin: new Point(100 + 8, 100),
      anchorPoint: new Point(100, 200)
    })
  })

  //   -----
  //   |   |
  //   | * |
  //   -----
  it('with fromRect - center bottom inside', () => {
    testPlacement({
      fromRect: new Rect(190, 300, 20, 20),
      placement: 'top',
      popoverOrigin: new Point(100, 100 - 8),
      anchorPoint: new Point(200, 300)
    })
  })

  //   -----
  //   |  *|
  //   -----
  it('with fromRect - center top inside', () => {
    testPlacement({
      fromRect: new Rect(300, 190, 20, 20),
      placement: 'left',
      popoverOrigin: new Point(100 - 8, 100),
      anchorPoint: new Point(300, 200)
    })
  })
})

describe('Test Restricting Size', () => {
  it('vertical', () => {
    let contentSize = {width: 200, height: 400}

    const wrapper = shallow(
      <Popover
        displayArea={{x: 0, y: 0, width: 400, height: 200}}
      >
        <View style={contentSize}><Text>Hi</Text></View>
      </Popover>
    )

    wrapper.instance().measureContent({
      nativeEvent: {
        layout: contentSize 
      }
    })

    expect(wrapper.state('requestedContentSize')).toBe(contentSize)
    expect(wrapper.state('forcedContentSize')).toEqual({width: 200, height: 200})
  })

  it('horizontal', () => {
    let contentSize = {width: 400, height: 200}

    const wrapper = shallow(
      <Popover
        displayArea={{x: 0, y: 0, width: 200, height: 400}}
      >
        <View style={contentSize}><Text>Hi</Text></View>
      </Popover>
    )

    wrapper.instance().measureContent({
      nativeEvent: {
        layout: contentSize 
      }
    })

    expect(wrapper.state('requestedContentSize')).toBe(contentSize)
    expect(wrapper.state('forcedContentSize')).toEqual({width: 200, height: 200})
  })
})
