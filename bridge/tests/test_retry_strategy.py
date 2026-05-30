"""Tests for retry strategy module."""
from clawd_relay_bridge.ws_client import ExponentialBackoff


class TestExponentialBackoff:
    """Tests for ExponentialBackoff retry strategy."""

    def test_initial_delay(self):
        """First retry (attempt 0) should return initial delay."""
        strategy = ExponentialBackoff()
        assert strategy.next_delay(0) == 1.0

    def test_doubles_each_attempt(self):
        """Delay should double each attempt."""
        strategy = ExponentialBackoff()
        assert strategy.next_delay(0) == 1.0
        assert strategy.next_delay(1) == 2.0
        assert strategy.next_delay(2) == 4.0
        assert strategy.next_delay(3) == 8.0

    def test_caps_at_max_delay(self):
        """Delay should cap at max_delay."""
        strategy = ExponentialBackoff(max_delay=10.0)
        assert strategy.next_delay(3) == 8.0
        assert strategy.next_delay(4) == 10.0
        assert strategy.next_delay(100) == 10.0

    def test_custom_initial_delay(self):
        """Custom initial_delay should be respected."""
        strategy = ExponentialBackoff(initial_delay=0.5)
        assert strategy.next_delay(0) == 0.5
        assert strategy.next_delay(1) == 1.0

    def test_custom_factor(self):
        """Custom factor should be respected."""
        strategy = ExponentialBackoff(factor=3.0)
        assert strategy.next_delay(0) == 1.0
        assert strategy.next_delay(1) == 3.0
        assert strategy.next_delay(2) == 9.0

    def test_attempt_zero_is_not_capped(self):
        """Attempt 0 should return initial_delay even if above max."""
        strategy = ExponentialBackoff(initial_delay=100.0, max_delay=10.0)
        assert strategy.next_delay(0) == 100.0


class TestRetryStrategyProtocol:
    """Tests that ExponentialBackoff satisfies the Protocol."""

    def test_is_callable(self):
        """next_delay should be callable and return float."""
        strategy = ExponentialBackoff()
        delay = strategy.next_delay(0)
        assert isinstance(delay, float)
