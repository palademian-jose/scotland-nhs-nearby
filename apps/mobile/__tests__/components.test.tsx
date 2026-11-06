import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CachedBadge } from '../src/components/CachedBadge';
import { CategoryChips } from '../src/components/CategoryChips';
import { FacilityRow } from '../src/components/FacilityRow';
import { PostcodeForm } from '../src/components/PostcodeForm';
import { PHARMACY } from './fixtures';

describe('CategoryChips', () => {
  it('labels every chip and marks the selected one', async () => {
    await render(<CategoryChips selected="dentist" onSelect={jest.fn()} />);
    for (const label of ['GP', 'Pharmacy', 'Dentist', 'Hospital', 'A&E']) {
      expect(screen.getByLabelText(label)).toBeOnTheScreen();
    }
    expect(screen.getByRole('tab', { name: 'Dentist', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'GP', selected: false })).toBeOnTheScreen();
  });

  it('reports the tapped category', async () => {
    const onSelect = jest.fn();
    await render(<CategoryChips selected="gp" onSelect={onSelect} />);
    await fireEvent.press(screen.getByLabelText('A&E'));
    expect(onSelect).toHaveBeenCalledWith('ae');
  });
});

describe('FacilityRow', () => {
  it('describes the row for screen readers and opens on press', async () => {
    const onPress = jest.fn();
    await render(<FacilityRow item={PHARMACY} onPress={onPress} />);
    const row = screen.getByRole('button', {
      name: 'Leith Pharmacy, Pharmacy, 400 m away, EH6 5AA',
    });
    expect(screen.getByText('400 m')).toBeOnTheScreen();
    expect(screen.getByText(/EH6 5AA · NHS Lothian/)).toBeOnTheScreen();
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledWith(PHARMACY);
  });

  it('shows the citation number in a badge in Ask results', async () => {
    await render(<FacilityRow item={PHARMACY} index={2} onPress={jest.fn()} />);
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.getByText('Leith Pharmacy')).toBeOnTheScreen();
  });
});

describe('CachedBadge', () => {
  it('shows the cached label with the age and the reason', async () => {
    await render(
      <CachedBadge savedAt={Date.now() - 5 * 60_000} reason="Cannot reach the server" />,
    );
    expect(screen.getByText('cached')).toBeOnTheScreen();
    expect(screen.getByText(/Saved 5 min ago\. Cannot reach the server/)).toBeOnTheScreen();
  });
});

describe('PostcodeForm', () => {
  it('keeps the button disabled until a full postcode length is typed', async () => {
    await render(<PostcodeForm onSubmit={jest.fn().mockResolvedValue(true)} />);
    expect(screen.getByRole('button', { name: 'Use this postcode' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), 'EH8 9YL');
    expect(screen.getByRole('button', { name: 'Use this postcode' })).toBeEnabled();
  });

  it('submits what was typed and shows the message it is given', async () => {
    const onSubmit = jest.fn().mockResolvedValue(false);
    await render(<PostcodeForm message="Location permission is off." onSubmit={onSubmit} />);
    expect(screen.getByText('Location permission is off.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), 'EH8 9YL');
    await fireEvent.press(screen.getByRole('button', { name: 'Use this postcode' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('EH8 9YL'));
  });
});
