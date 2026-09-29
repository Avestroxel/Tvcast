import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebsite, publicAddress, websiteUrl } from '../server/website-browser.ts';
import { embeddedSource } from '../src/lib/media-source.ts';

test('browse a normal website then choose videos from relative sources, embeds and structured metadata', () => {
  const listing = parseWebsite('<title>Films</title><a href="/films/one">First film</a><a href="javascript:alert(1)">Unsafe</a>', 'https://example.com/');
  assert.deepEqual(listing.links, [{ title: 'First film', url: 'https://example.com/films/one' }]);
  const page = parseWebsite(`
    <title>First film</title>
    <video title="Main video"><source src="../../media/movie.mp4?signature=hello"></video>
    <a href="https://www.youtube.com/watch?v=M7lc1UVf-VE">YouTube trailer</a>
    <iframe src="https://player.vimeo.com/video/76979871" title="Vimeo preview"></iframe>
    <script type="application/ld+json">{"@type":"VideoObject","name":"Alternative source","contentUrl":"https://cdn.example.com/play?id=1"}</script>
    <a href="/films/two">Next film</a>`, listing.links[0].url);
  assert.equal(page.videos.length, 4);
  assert.ok(page.videos.some((video) => video.url === 'https://example.com/media/movie.mp4?signature=hello'));
  assert.ok(page.videos.some((video) => video.kind === 'youtube' && video.title === 'YouTube trailer'));
  assert.ok(page.videos.some((video) => video.kind === 'vimeo'));
  assert.ok(page.videos.some((video) => video.title === 'Alternative source'));
  assert.deepEqual(page.links, [{ title: 'Next film', url: 'https://example.com/films/two' }]);
});

test('no videos is an honest empty state and unsafe metadata is not selectable', () => {
  const page = parseWebsite('<title>Dynamic page</title><video src="file:///etc/passwd"></video><a href="data:text/html,hello">Bad</a><script type="application/ld+json">invalid</script>', 'https://example.com/');
  assert.equal(page.videos.length, 0);
  assert.equal(page.links.length, 0);
  assert.match(page.note!, /No selectable videos/);
});

test('recognize video page links, mobile links, shorts and unlisted Vimeo without lookalike hosts', () => {
  for (const url of ['https://youtu.be/M7lc1UVf-VE', 'https://m.youtube.com/watch?v=M7lc1UVf-VE', 'https://youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE']) {
    assert.equal(embeddedSource(url)?.id, 'M7lc1UVf-VE');
  }
  assert.equal(embeddedSource('https://vimeo.com/76979871/abcdef1234')?.hash, 'abcdef1234');
  assert.equal(embeddedSource('https://youtube.com.evil.example/watch?v=M7lc1UVf-VE'), null);
  assert.equal(embeddedSource('https://youtube.com/watch?v=invalid'), null);
  assert.equal(embeddedSource('https://vimeo.com/channels/staffpicks'), null);
});

test('public fetch policy excludes private IPv4, mapped IPv6, link-local and reserved ranges', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '224.1.1.1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.equal(publicAddress('2606:4700:4700::1111'), true);
  for (const value of ['http://example.com', 'https://localhost', 'https://foo.local', 'https://example.com:8443', 'https://user:pass@example.com']) assert.throws(() => websiteUrl(value));
});
