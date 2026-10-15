## Flows to demo
0. (maybe) Android and iOS in simulator preview only
1. Developing in an orchestrator like Conductor or Paseo with EAS Simulators
2. Validation with a tag on a PR, branch between iOS and Android. Show simulator previews.
3. e2e bug bash with EAS Simulators
4. Triage and develop issue - Jacob's flow


5. EAS Observe

Test changes:
- Implement blurhash for dynamic images, like pictures of shoes
- switch to native tabs by default, make sure safe areas are correct
- change the challenge to a 10k for the week

Bug fix: when I tap on the search button on the home tab, it opens up the search UX. When I tap the X, I'm on the search tab, even though I started on the home tab. I feel like it should return me to where I was originally (the home tab)