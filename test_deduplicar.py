import pytest
from deduplicar import prefer_original

def test_prefer_original():
    # Nombres simples y limpios deben tener un puntaje bajo (largo de cadena)
    score_clean = prefer_original("planilla_2023.pdf")
    
    # Nombres con '(1)' deben ser penalizados con +1000
    score_duplicate1 = prefer_original("planilla_2023 (1).pdf")
    
    # Nombres con 'copia' deben ser penalizados con +1000
    score_duplicate2 = prefer_original("copia de planilla_2023.pdf")
    
    # El puntaje del original debe ser mucho menor que el de las copias
    assert score_clean < score_duplicate1
    assert score_clean < score_duplicate2
    
    # Ambos tienen penalización, así que deben ser mayores a 1000
    assert score_duplicate1 > 1000
    assert score_duplicate2 > 1000
