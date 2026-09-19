import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { t } from '@/lib/t';

/**
 * PhotoPicker (improvement plan B9). No DOM library is installed, so the
 * markup comes from react-dom/server and the change handlers are reached by
 * walking the element tree; both are enough to pin the contract: a real
 * `<input type="file">` inside a `<label>`, `capture` only on the camera
 * input, actions gone when the meal has its three photos.
 */

const coarse = vi.fn(() => false);
vi.mock('@/components/product/meal/use-coarse-pointer', () => ({
  useCoarsePointer: () => coarse(),
}));

const { PhotoPicker } = await import('@/components/product/meal/PhotoPicker');
const { PHOTOS_PER_MEAL } = await import('@/components/product/photo-input');

type Props = Parameters<typeof PhotoPicker>[0];

function photo(n: number): Props['photos'][number] {
  return { uploadId: `u${n}`, previewUrl: '', width: 100, height: 100 };
}

function props(overrides: Partial<Props> = {}): Props {
  return { photos: [], busy: false, onAdd: vi.fn(), onRemove: vi.fn(), ...overrides };
}

function render(p: Props): string {
  return renderToStaticMarkup(createElement(PhotoPicker, p));
}

/** Every `<input …>` tag in the markup, as its attribute string. */
function inputs(html: string): string[] {
  return Array.from(html.matchAll(/<input\b([^>]*)>/g), (m) => m[1]);
}

interface HostInput {
  'data-testid': string;
  onChange: (event: { target: { files: File[]; value: string } }) => void;
}

/** Expands function components (the mocked hook is the only one) and collects `<input>` props. */
function hostInputs(node: ReactNode, out: HostInput[] = []): HostInput[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => hostInputs(child, out));
    return out;
  }
  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === 'function') {
    hostInputs((element.type as (p: unknown) => ReactNode)(element.props), out);
  } else if (element.type === 'input') {
    out.push(element.props as unknown as HostInput);
  } else if (element.props && 'children' in element.props) {
    hostInputs(element.props.children as ReactNode, out);
  }
  return out;
}

function file(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

beforeEach(() => {
  coarse.mockReturnValue(false);
});

describe('PhotoPicker', () => {
  it('fine pointer: one "Add photo" label with a multiple file input and no capture', () => {
    const html = render(props());
    const found = inputs(html);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('type="file"');
    expect(found[0]).toContain('data-testid="photo-input"');
    expect(found[0]).toContain('accept="image/*,.heic,.heif"');
    expect(found[0]).toContain('multiple');
    expect(found[0]).not.toContain('capture');
    expect(html).toContain(t('meal.compose.addPhoto'));
    expect(html).not.toContain(t('meal.compose.photoTake'));
    // The input sits inside the label so the browser opens the picker on tap.
    expect(html).toMatch(/<label[^>]*data-testid="add-photo"[^>]*>(?:(?!<\/label>).)*<input/s);
  });

  it('coarse pointer: Take photo (capture, single) and Choose from gallery (multiple, HEIC)', () => {
    coarse.mockReturnValue(true);
    const html = render(props());
    const found = inputs(html);
    expect(found).toHaveLength(2);
    const camera = found.find((i) => i.includes('data-testid="photo-input-camera"'));
    const gallery = found.find((i) => i.includes('data-testid="photo-input"'));
    expect(camera).toContain('capture="environment"');
    expect(camera).toContain('accept="image/*"');
    expect(camera).not.toContain('multiple');
    expect(gallery).toContain('multiple');
    expect(gallery).not.toContain('capture');
    expect(html).toContain('data-testid="take-photo"');
    expect(html).toContain('data-testid="add-photo"');
    expect(html).toContain(t('meal.compose.photoTake'));
    expect(html).toContain(t('meal.compose.photoGallery'));
    expect(html).not.toContain(t('meal.compose.addPhoto'));
  });

  it('inputs are focusable with an accessible name (no tabindex=-1, no aria-hidden)', () => {
    coarse.mockReturnValue(true);
    for (const input of inputs(render(props()))) {
      expect(input).not.toContain('tabindex');
      expect(input).not.toContain('aria-hidden');
      expect(input).toMatch(/aria-label="[^"]+"/);
    }
  });

  it('selecting files calls onAdd, capped at the remaining slots', () => {
    coarse.mockReturnValue(true);
    const onAdd = vi.fn();
    const tree = PhotoPicker(props({ photos: [photo(1)], onAdd }));
    const [camera, gallery] = hostInputs(tree);
    expect(camera['data-testid']).toBe('photo-input-camera');
    expect(gallery['data-testid']).toBe('photo-input');

    const a = file('a.jpg');
    const b = file('b.jpg');
    const c = file('c.jpg');
    const event = { target: { files: [a, b, c], value: 'C:\\fakepath\\a.jpg' } };
    gallery.onChange(event);
    expect(onAdd).toHaveBeenCalledWith([a, b]);
    expect(event.target.value).toBe('');

    camera.onChange({ target: { files: [c], value: 'x' } });
    expect(onAdd).toHaveBeenLastCalledWith([c]);

    camera.onChange({ target: { files: [], value: '' } });
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it('busy disables the inputs but keeps the actions rendered', () => {
    coarse.mockReturnValue(true);
    const html = render(props({ busy: true }));
    const found = inputs(html);
    expect(found).toHaveLength(2);
    found.forEach((i) => expect(i).toContain('disabled'));
  });

  it('full (three photos) hides every action and keeps the remove buttons', () => {
    coarse.mockReturnValue(true);
    const photos = Array.from({ length: PHOTOS_PER_MEAL }, (_, i) => photo(i + 1));
    const html = render(props({ photos }));
    expect(inputs(html)).toHaveLength(0);
    expect(html).not.toContain('data-testid="add-photo"');
    expect(html).not.toContain('data-testid="take-photo"');
    expect(html).toContain(t('meal.compose.removePhoto', { index: 3 }));
    expect(html).toContain(t('meal.compose.photosMax', { max: PHOTOS_PER_MEAL }));
  });
});
