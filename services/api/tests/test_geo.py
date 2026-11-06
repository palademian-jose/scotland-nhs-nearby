from nhs_nearby.geo import find_postcode, haversine_km, normalise_postcode


def test_haversine_edinburgh_glasgow():
    d = haversine_km(55.9533, -3.1883, 55.8642, -4.2518)
    assert 66 < d < 68


def test_haversine_zero_and_symmetric():
    assert haversine_km(57.1, -2.1, 57.1, -2.1) == 0
    assert haversine_km(55.0, -3.0, 56.0, -4.0) == haversine_km(56.0, -4.0, 55.0, -3.0)


def test_normalise_postcode():
    assert normalise_postcode("eh89yl") == "EH8 9YL"
    assert normalise_postcode(" AB10 1QN ") == "AB10 1QN"
    assert normalise_postcode("G1 1AA") == "G1 1AA"
    assert normalise_postcode("not a postcode") is None
    assert normalise_postcode("") is None
    assert normalise_postcode(None) is None


def test_find_postcode_in_text():
    assert find_postcode("nearest gp to eh8 9yl please") == "EH8 9YL"
    assert find_postcode("nearest gp to leith") is None
