import React, { Component } from 'react'

import whitelisted from 'knowitwhenyouseeit'

const getMessage = whitelisted(
  "$2y$12$BcuZ0VfUeLLpoLxOC5Xv7eQQK0r95by8YJsECCldKP4ftPr20rpXW", //hello world
  "$2y$12$hxyWxMx.qap70Snn1QKMwuDp/9XgNM7HpwbrGnsPu/j7dyTEWh0M2" //hewwo world
)


export default class App extends Component {
  render () {
    return (
      <div style={{margin: "auto", maxWidth: "20rem"}}>
      <h1>knowitwhenyouseeit</h1>
      <p/> knowitwhenyouseeit is a tiny library for displaying
      whitelisted, secret information without requiring a backend
      using bcrypt hashes.

      <p/> Sometimes you might want to put your phone number online,
      but only have certian people with the number in a URL
      see it.

      <p/> You don't want to put the number in the client, or
      it will be public. You don't want to have to create a backend
      just to validate one thing.

      <p/> And equally you probably don't want anyone to pass a random
      phone number as a parameter and display false content to others.

      <p/> That's where knowitwhenyouseeit comes in. You pass it a list
      of bcrypt hashes and it only displays content if it matches
      the hash.

      <p/> Here, I have "hello world" and "hewwo world" whitelisted by
      bcrypt hash.

      <p/> It displays just fine when we try to display "hello world"
      <p/><b>{getMessage("hello world")}</b>
      <p/> but if we try to render anything else, knowitwhenyouseeit
      returns 'false' -- I've conditionally rendered a message based
      on that.
      <p/><b>{getMessage("hello world!") || "blocked non-whitelisted message"}</b>
      </div>
    )
  }
}
