import { PLANS } from '@codecollab/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IntervalToggle, PlanCard, TestModeNote } from './plan-cards';

describe('plan card', () => {
  it('prices Pro per period, in rupees', () => {
    const { rerender } = render(<PlanCard plan="pro" interval="month" action={null} />);
    expect(screen.getByText(`₹${PLANS.pro.price.monthly.toLocaleString('en-IN')}`)).toBeVisible();
    expect(screen.getByText('for a month')).toBeVisible();

    rerender(<PlanCard plan="pro" interval="year" action={null} />);
    expect(screen.getByText(`₹${PLANS.pro.price.yearly.toLocaleString('en-IN')}`)).toBeVisible();
    expect(screen.getByText('for a year')).toBeVisible();
    expect(screen.getByText(/Works out at/)).toBeVisible();
  });

  it('says Pro does not renew by itself', () => {
    render(<PlanCard plan="pro" interval="month" action={null} />);
    expect(screen.getByText(/doesn’t renew by itself/)).toBeVisible();
  });

  it('shows Free as free forever, with no renewal note', () => {
    render(<PlanCard plan="free" interval="month" action={null} />);
    expect(screen.getByText('₹0')).toBeVisible();
    expect(screen.getByText('forever')).toBeVisible();
    expect(screen.queryByText(/renew/)).not.toBeInTheDocument();
  });

  it('marks the plan someone is already on', () => {
    const { rerender } = render(<PlanCard plan="free" interval="month" current action={null} />);
    expect(screen.getByText('Your plan')).toBeVisible();

    rerender(<PlanCard plan="free" interval="month" action={null} />);
    expect(screen.queryByText('Your plan')).not.toBeInTheDocument();
  });

  it('lists what the plan includes', () => {
    render(<PlanCard plan="pro" interval="month" action={<button>Get Pro</button>} />);
    for (const feature of PLANS.pro.features) {
      expect(screen.getByText(feature)).toBeVisible();
    }
    expect(screen.getByRole('button', { name: 'Get Pro' })).toBeVisible();
  });
});

describe('billing period toggle', () => {
  it('is a radio group where the chosen period is selected', () => {
    render(<IntervalToggle value="month" onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Billing period' });
    expect(group).toBeVisible();
    expect(screen.getByRole('radio', { name: /Monthly/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Yearly/ })).not.toBeChecked();
  });

  it('reports the period someone picks', async () => {
    const onChange = vi.fn();
    render(<IntervalToggle value="month" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /Yearly/ }));
    expect(onChange).toHaveBeenCalledWith('year');
  });

  it('shows what a year saves, from the real prices', () => {
    const saving = Math.round(
      100 - (PLANS.pro.price.yearly / (PLANS.pro.price.monthly * 12)) * 100,
    );
    render(<IntervalToggle value="month" onChange={() => {}} />);
    expect(screen.getByText(`save ${saving}%`)).toBeVisible();
  });
});

it('tells people how to pay in test mode', () => {
  render(<TestModeNote />);
  expect(screen.getByText(/Payments are in test mode/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'test cards' })).toHaveAttribute(
    'href',
    expect.stringContaining('razorpay.com'),
  );
});
